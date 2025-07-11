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
	type:            'custom-element' | 'import' | 'local-variable' | 'wildcard-export' | 'unknown';
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
	dirname:      (path: string) => string;
}

interface ResolverAdapter {
	sync: (basedir: string, module: string) => { path?: string; };
}


export class ImportDiscovery {

	static readonly definitionCache:   Map<string, Map<string, ElementDefinition>> = new Map();
	static readonly fileBindingsCache: Map<string, ReadonlyMap<string, ElementDefinition>> = new Map();
	static readonly fileDependencies:  Map<string, Set<string>> = new Map();
	static readonly EMPTY_BINDINGS:    ReadonlyMap<string, ElementDefinition> = new Map();

	static clearCacheForFileAndDependents(changedFilePath: string): void {
		// Clear the changed file itself
		ImportDiscovery.definitionCache.delete(changedFilePath);
		ImportDiscovery.fileBindingsCache.delete(changedFilePath);
		ImportDiscovery.fileDependencies.delete(changedFilePath);

		// Find and clear all files that depend on the changed file in one pass
		for (const [ file, dependencies ] of ImportDiscovery.fileDependencies) {
			if (!dependencies.has(changedFilePath))
				continue;

			ImportDiscovery.definitionCache.delete(file);
			ImportDiscovery.fileBindingsCache.delete(file);
			ImportDiscovery.fileDependencies.delete(file);
		}
	}

	protected readonly visitedFiles: Set<string> = new Set();
	protected readonly resolver:     ResolverAdapter;
	protected readonly log:          Logger<never, boolean>;
	protected readonly fs:           FileSystemAdapter;

	constructor() {
		this.resolver = oxcResolver;
		this.log      = createLogger('import-discovery', debugMode.value);
		this.fs       = { existsSync, readFileSync, dirname };
	}

	/**
	 * Finds the definition of a JSX element in the given path.
	 */
	findElementDefinition(
		path: NodePath<t.JSXOpeningElement>,
	): ElementDefinition {
		this.visitedFiles.clear();

		const filePath = getPathFilename(path);
		const cacheKey = String(path.node.start);

		const fileCache = ImportDiscovery.definitionCache.get(filePath);
		if (fileCache) {
			const cached = fileCache.get(cacheKey);
			if (cached)
				return cached;
		}

		if (!t.isJSXIdentifier(path.node.name))
			return { type: 'unknown' };

		const elementName = path.node.name.name;
		if (!isComponent(elementName))
			return { type: 'unknown' };

		const currentFileName = getPathFilename(path);
		const result = this.traceElementDefinition(elementName, path.scope, currentFileName);

		// Store in file-specific cache
		const definitionCache = ImportDiscovery.definitionCache.get(filePath)
			?? ImportDiscovery.definitionCache
				.set(filePath, new Map())
				.get(filePath)!;

		definitionCache.set(cacheKey, result);

		return result;
	}

	// Trace the element definition recursively
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

	// Analyze all relevant bindings in a file at once
	protected analyzeFileBindings(filePath: string): ReadonlyMap<string, ElementDefinition> {
		const fileBinding = ImportDiscovery.fileBindingsCache.get(filePath);
		if (fileBinding)
			return fileBinding;

		if (!this.fs.existsSync(filePath)) {
			ImportDiscovery.fileBindingsCache.set(filePath, ImportDiscovery.EMPTY_BINDINGS);

			return ImportDiscovery.EMPTY_BINDINGS;
		}

		const fileContent = this.fs.readFileSync(filePath, 'utf-8');
		let ast: t.File;

		try {
			ast = babel.parseSync(fileContent, {
				filename:   filePath,
				parserOpts: {
					plugins: Array.from(babelPlugins),
				},
			})!;
		}
		catch (error) {
			// Failed to parse, cache empty result
			ImportDiscovery.fileBindingsCache.set(filePath, ImportDiscovery.EMPTY_BINDINGS);

			return ImportDiscovery.EMPTY_BINDINGS;
		}

		let programPath: babel.NodePath<babel.types.Program> = undefined as any;
		traverse(ast, { Program(path) { programPath = path; path.stop(); } });

		const bindings: Map<string, ElementDefinition> = new Map();

		// 1. Analyze all relevant local bindings at once
		this.analyzeFileDeclarations(programPath, filePath, bindings);

		// 2. Analyze all exports at once
		this.analyzeFileExports(programPath, filePath, bindings);

		const readonlyBindings = new Map(bindings) as ReadonlyMap<string, ElementDefinition>;
		ImportDiscovery.fileBindingsCache.set(filePath, readonlyBindings);

		return readonlyBindings;
	}

	// Resolve lazy references in the definition
	protected analyzeFileDeclarations(
		programPath: babel.NodePath<babel.types.Program>,
		filePath: string,
		bindings: Map<string, ElementDefinition>,
	): void {
		for (const [ name, binding ] of Object.entries(programPath.scope.bindings)) {
			// Skip function/import bindings that are clearly not component-related
			if (binding.kind === 'module' || binding.kind === 'hoisted') {
				if (!isComponent(name))
					continue;
			}

			const definition = this.analyzeBindingFast(binding, filePath);
			if (definition.type !== 'unknown')
				bindings.set(name, definition);
		}
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
		if (functionName === 'toComponent' || functionName === 'toTag')
			return true;

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

		return isOriginallyToComponentOrTag;
	}

	// Analyze all exports in one pass
	protected analyzeFileExports(
		programPath: babel.NodePath<babel.types.Program>,
		filePath: string,
		bindings: Map<string, ElementDefinition>,
	): void {
		for (const statement of programPath.node.body) {
			// Handle named exports: export { X } from './file' or export { X }
			if (t.isExportNamedDeclaration(statement)) {
				for (const specifier of statement.specifiers) {
					if (!t.isExportSpecifier(specifier))
						continue;

					const exportedName = t.isIdentifier(specifier.exported)
						? specifier.exported.name
						: specifier.exported.value;

					const localName = specifier.local.name;

					if (!isComponent(exportedName))
						continue;

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
				}
			}
			// Handle wildcard exports: export * from './file'
			else if (t.isExportAllDeclaration(statement) && statement.source) {
				// For wildcard exports, we need to mark this as a wildcard re-export
				// The actual resolution will happen in resolveLazyDefinition
				const definition = {
					type:   'wildcard-export' as const,
					source: statement.source.value,
				};
				// Store with a special key to indicate wildcard export
				bindings.set('*', definition);
			}
		}
	}

	// Resolve lazy definitions (imports, references)
	protected resolveLazyDefinition(definition: ElementDefinition): ElementDefinition {
		if (definition.type === 'import' && definition.resolvedPath && definition.originalName) {
			if (definition.source) {
				const currentFile = definition.source;
				const dependsOn = definition.resolvedPath;

				let fileDependencies = ImportDiscovery.fileDependencies.get(currentFile);
				if (!fileDependencies) {
					fileDependencies = new Set<string>();
					ImportDiscovery.fileDependencies.set(currentFile, fileDependencies);
				}

				fileDependencies.add(dependsOn);
			}

			// Recursively analyze the imported file
			const importedBindings = this.analyzeFileBindings(definition.resolvedPath);
			const binding = importedBindings.get(definition.originalName);

			if (binding) // Recursively resolve the found definition
				return this.resolveLazyDefinition(binding);

			// If specific export not found, check for wildcard exports
			const wildcardExport = importedBindings.get('*');
			if (wildcardExport && wildcardExport.type === 'wildcard-export') {
				// Resolve the wildcard export by looking in the target file
				const currentDir = this.fs.dirname(definition.resolvedPath);
				const resolvedResult = this.resolver.sync(currentDir, wildcardExport.source!);
				const resolvedPath = resolvedResult.path;

				if (resolvedPath) {
					// Create a new import definition for the wildcard target
					const wildcardTargetDefinition: ElementDefinition = {
						type:         'import',
						source:       wildcardExport.source,
						originalName: definition.originalName,
						localName:    definition.localName,
						resolvedPath: resolvedPath,
					};

					return this.resolveLazyDefinition(wildcardTargetDefinition);
				}
			}
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

}


let discovery: ImportDiscovery;
export const findElementDefinition = (
	...args: Parameters<ImportDiscovery['findElementDefinition']>
): ReturnType<ImportDiscovery['findElementDefinition']> => {
	discovery ??= new ImportDiscovery();

	return discovery.findElementDefinition(...args);
};
