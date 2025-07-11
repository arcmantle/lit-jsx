import { existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

import * as babel from '@babel/core';
import type { Binding, NodePath, Scope } from '@babel/traverse';
import * as t from '@babel/types';
import oxcResolver from 'oxc-resolver';
import type { Logger } from 'pino';

import { traverse } from './babel-traverse.ts';
import { getPathFilename, isComponent } from './compiler-utils.ts';
import { babelPlugins, debugMode } from './config.ts';
import { createLogger } from './create-logger.ts';


export interface ElementDefinition {
	type:            'custom-element' | 'import' | 'local-variable' | 'unknown';
	source?:         string;
	originalName?:   string;
	localName?:      string;
	callExpression?: t.CallExpression;
	resolvedPath?:   string; // For lazy import resolution
	referencedName?: string; // For lazy local reference resolution
}

interface FileSystemAdapter {
	existsSync:   (path: string) => boolean;
	readFileSync: (path: string, encoding: 'utf-8') => string;
}

interface ResolverAdapter {
	sync: (basedir: string, module: string) => { path?: string; };
}


class ImportDiscovery {

	static readonly fileCache:         Map<string, t.File> = new Map();
	static readonly definitionCache:   Map<string, ElementDefinition> = new Map();
	static readonly fileBindingsCache: Map<string, Map<string, ElementDefinition>> = new Map();

	// Add cache clearing method
	static clearFileBindingsCache(): void {
		ImportDiscovery.fileBindingsCache.clear();
	}

	protected readonly visitedFiles: Set<string> = new Set();

	protected fs:       FileSystemAdapter = { existsSync, readFileSync };
	protected resolver: ResolverAdapter = oxcResolver;
	protected log:      Logger<never, boolean>;

	findElementDefinition(
		path: NodePath<t.JSXOpeningElement>,
	): ElementDefinition {
		this.visitedFiles.clear();
		this.log ??= createLogger('import-discovery', debugMode.value);

		const cacheKey = this.getCallSiteKey(path);
		if (ImportDiscovery.definitionCache.has(cacheKey))
			return ImportDiscovery.definitionCache.get(cacheKey)!;

		const elementName = path.node.name;

		if (!t.isJSXIdentifier(elementName))
			return { type: 'unknown' };

		if (!isComponent(elementName.name))
			return { type: 'unknown' };

		const currentFileName = getPathFilename(path);
		const result = this.traceElementDefinition(elementName.name, path.scope, currentFileName);

		ImportDiscovery.definitionCache.set(cacheKey, result);

		return result;
	}

	// Generate a unique cache key for each call site
	protected getCallSiteKey(path: NodePath<t.JSXOpeningElement>): string {
		const filename = getPathFilename(path);
		const start = path.node.start;

		if (typeof start !== 'number')
			throw new Error(`Invalid start position for JSX element in ${ filename }`);

		return `${ filename }:${ start }`;
	}

	protected traceElementDefinition(
		elementName: string,
		scope: Scope,
		currentFileName: string,
	): ElementDefinition {
		const traceKey = `${ currentFileName }:${ elementName }`;

		// Prevent infinite recursion
		if (this.visitedFiles.has(traceKey))
			return { type: 'unknown' };

		this.visitedFiles.add(traceKey);

		// Use batched file analysis
		const fileBindings = this.analyzeFileBindings(currentFileName);

		// Check if we have this element in our batch analysis
		if (fileBindings.has(elementName)) {
			const definition = fileBindings.get(elementName)!;

			// Resolve any lazy references
			return this.resolveLazyDefinition(definition);
		}

		// Fallback to scope-based lookup for dynamic cases
		const binding = scope.getBinding(elementName);
		if (!binding)
			return { type: 'unknown' };

		// Use the fast analysis methods
		const result = this.analyzeBindingFast(binding, currentFileName);

		// Resolve any lazy references (imports, local references)
		return this.resolveLazyDefinition(result);
	}

	// New method: Analyze all relevant bindings in a file at once
	protected analyzeFileBindings(filePath: string): Map<string, ElementDefinition> {
		// Check cache first
		if (ImportDiscovery.fileBindingsCache.has(filePath))
			return ImportDiscovery.fileBindingsCache.get(filePath)!;

		const ast = this.getOrParseFile(filePath);
		if (!ast) {
			const emptyMap: Map<string, ElementDefinition> = new Map();
			ImportDiscovery.fileBindingsCache.set(filePath, emptyMap);

			return emptyMap;
		}

		const bindings: Map<string, ElementDefinition> = new Map();

		// Single traversal to collect ALL component-related info
		traverse(ast, {
			Program: (programPath) => {
				// 1. Analyze all relevant local bindings at once
				Object.entries(programPath.scope.bindings).forEach(([ name, binding ]) => {
					// Skip function/import bindings that are clearly not component-related
					if (binding.kind === 'module' || binding.kind === 'hoisted') {
						if (!isComponent(name))
							return;
					}

					const definition = this.analyzeBindingFast(binding, filePath);
					if (definition.type !== 'unknown')
						bindings.set(name, definition);
				});

				// 2. Analyze all exports at once
				this.analyzeExports(programPath, filePath, bindings);

				programPath.stop(); // We only need the Program level
			},
		});

		ImportDiscovery.fileBindingsCache.set(filePath, bindings);

		return bindings;
	}

	// Fast binding analysis without deep traversal
	protected analyzeBindingFast(
		binding: Binding,
		filePath: string,
	): ElementDefinition {
		// Handle imports
		if (binding.kind === 'module' && t.isImportSpecifier(binding.path.node))
			return this.analyzeImportBinding(binding, filePath);

		// Handle local variables
		if (binding.kind === 'const' || binding.kind === 'let' || binding.kind === 'var')
			return this.analyzeLocalBinding(binding, filePath);

		return { type: 'unknown' };
	}

	// Analyze import without deep file traversal
	protected analyzeImportBinding(binding: Binding, currentFileName: string): ElementDefinition {
		const importDeclaration = binding.path.parent;
		if (!t.isImportDeclaration(importDeclaration))
			return { type: 'unknown' };

		const importSpecifier = binding.path.node;
		if (!t.isImportSpecifier(importSpecifier))
			return { type: 'unknown' };

		const originalExportedName = t.isIdentifier(importSpecifier.imported)
			? importSpecifier.imported.name
			: importSpecifier.imported.value;

		const importSource = importDeclaration.source.value;
		const currentDir = dirname(currentFileName);

		const resolvedResult = this.resolver.sync(currentDir, importSource);
		const resolvedPath = resolvedResult.path;

		if (!resolvedPath)
			return { type: 'unknown' };

		// Instead of deep traversal, just mark as import and resolve lazily
		return {
			type:         'import',
			source:       importSource,
			originalName: originalExportedName,
			localName:    binding.identifier.name,
			// Store resolved path for later lookup
			resolvedPath: resolvedPath,
		};
	}

	// Analyze local binding without recursion
	protected analyzeLocalBinding(binding: Binding, filePath: string): ElementDefinition {
		if (!t.isVariableDeclarator(binding.path.node))
			return { type: 'local-variable' };


		const declarator = binding.path.node;
		if (!declarator.init)
			return { type: 'local-variable' };


		// Check for toComponent/toTag calls
		if (t.isCallExpression(declarator.init)) {
			if (this.isToComponentOrTagCall(declarator.init, binding.path.scope)) {
				return {
					type:           'custom-element',
					source:         filePath,
					callExpression: declarator.init,
				};
			}
		}

		// For identifier assignments, store reference for later resolution
		if (t.isIdentifier(declarator.init)) {
			return {
				type:           'local-variable',
				source:         filePath,
				referencedName: declarator.init.name,
			};
		}

		return { type: 'local-variable' };
	}

	// Analyze all exports in one pass
	protected analyzeExports(
		programPath: babel.NodePath<babel.types.Program>,
		filePath: string,
		bindings: Map<string, ElementDefinition>,
	): void {
		programPath.node.body.forEach(statement => {
			if (!t.isExportNamedDeclaration(statement))
				return;

			statement.specifiers.forEach(specifier => {
				if (!t.isExportSpecifier(specifier))
					return;

				const exportedName = t.isIdentifier(specifier.exported)
					? specifier.exported.name
					: specifier.exported.value;

				const localName = specifier.local.name;

				if (!isComponent(exportedName))
					return;

				// For re-exports with source
				if (statement.source) {
					const definition = {
						type:         'import' as const,
						source:       statement.source.value,
						originalName: localName,
						localName:    exportedName,
					};
					bindings.set(exportedName, definition);
				}
				else {
					// For local exports, reference the local binding
					const definition = {
						type:           'local-variable' as const,
						source:         filePath,
						referencedName: localName,
						localName:      exportedName,
					};
					bindings.set(exportedName, definition);
				}
			});
		});
	}

	// Resolve lazy definitions (imports, references)
	protected resolveLazyDefinition(definition: ElementDefinition): ElementDefinition {
		if (definition.type === 'import' && definition.resolvedPath && definition.originalName) {
			// Recursively analyze the imported file
			const importedBindings = this.analyzeFileBindings(definition.resolvedPath);
			const binding = importedBindings.get(definition.originalName);

			if (binding) // Recursively resolve the found definition
				return this.resolveLazyDefinition(binding);
		}

		if (definition.type === 'local-variable' && definition.referencedName && definition.source) {
			// Resolve local references
			const fileBindings = this.analyzeFileBindings(definition.source);
			const binding = fileBindings.get(definition.referencedName);

			if (binding)
				return this.resolveLazyDefinition(binding);
		}

		return definition;
	}

	// Helper function to get or parse a file with caching
	protected getOrParseFile(filePath: string): t.File | undefined {
		// Check cache first
		if (ImportDiscovery.fileCache.has(filePath)) {
			//this.log.trace({
			//	path: filePath,
			//	fn:   'getOrParseFile',
			//}, 'Using cached AST');

			return ImportDiscovery.fileCache.get(filePath)!;
		}

		// File not in cache, parse it
		if (!this.fs.existsSync(filePath)) {
			//this.log.warn({
			//	path: filePath,
			//	fn:   'getOrParseFile',
			//}, 'File does not exist');

			return;
		}

		const fileContent = this.fs.readFileSync(filePath, 'utf-8');

		try {
			const ast = babel.parseSync(fileContent, {
				filename:   filePath,
				parserOpts: {
					plugins: babelPlugins,
				},
			});

			if (ast) {
				//this.log.trace({
				//	path: filePath,
				//	fn:   'getOrParseFile',
				//}, 'Parsed and cached file');

				ImportDiscovery.fileCache.set(filePath, ast);

				return ast;
			}
		}
		catch (error) {
			//this.log.error({
			//	path:  filePath,
			//	error: String(error),
			//	fn:    'getOrParseFile',
			//}, 'Failed to parse file');
		}
	}

	// Helper function to check if a call expression is a toComponent/toTag call
	// even if the function has been renamed through imports
	protected isToComponentOrTagCall(
		callExpr: t.CallExpression,
		scope: Scope,
	): boolean {
		if (!t.isIdentifier(callExpr.callee))
			return false;

		const functionName = callExpr.callee.name;

		// Check direct names first (fast path)
		if (functionName === 'toComponent' || functionName === 'toTag') {
			//this.log.trace({
			//	function: functionName,
			//	fn:       'isToComponentOrTagCall',
			//}, 'Found direct function call');

			return true;
		}

		// Check if this identifier is bound to an import that originally was toComponent/toTag
		const binding = scope.getBinding(functionName);
		if (!binding || binding.kind !== 'module')
			return false;

		if (!t.isImportSpecifier(binding.path.node))
			return false;

		const importSpecifier = binding.path.node;
		const originalImportedName = t.isIdentifier(importSpecifier.imported)
			? importSpecifier.imported.name
			: importSpecifier.imported.value;

		// Check if the original imported name was toComponent or toTag
		const isOriginallyToComponentOrTag =
				originalImportedName === 'toComponent'
			|| originalImportedName === 'toTag';

		if (isOriginallyToComponentOrTag) {
			//this.log.trace({
			//	originalName: originalImportedName,
			//	localName:    functionName,
			//	fn:           'isToComponentOrTagCall',
			//}, 'Found renamed function call');
		}

		return isOriginallyToComponentOrTag;
	}

}
const discovery: ImportDiscovery = new ImportDiscovery();


export const findElementDefinition: typeof discovery.findElementDefinition =
	discovery.findElementDefinition.bind(discovery);
