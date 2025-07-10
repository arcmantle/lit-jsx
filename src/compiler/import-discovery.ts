import { existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

import * as babel from '@babel/core';
import type { Binding, NodePath, Scope } from '@babel/traverse';
import * as t from '@babel/types';
import resolve from 'oxc-resolver';
import type { Logger } from 'pino';

import { traverse } from './babel-traverse.ts';
import { getPathFilename, isComponent } from './compiler-utils.ts';
import { type BabelPlugins, babelPlugins, debugMode } from './config.ts';
import { createLogger } from './create-logger.ts';


export interface ElementDefinition {
	type:            'custom-element' | 'import' | 'local-variable' | 'unknown';
	source?:         string;
	originalName?:   string;
	localName?:      string;
	callExpression?: t.CallExpression;
}

export interface ImportDiscoveryConfig {
	debugMode?: boolean;
	plugins?:   BabelPlugins;
}

export interface FileSystemAdapter {
	existsSync:   (path: string) => boolean;
	readFileSync: (path: string, encoding: 'utf-8') => string;
}

export interface ResolverAdapter {
	sync: (basedir: string, module: string) => { path?: string; };
}


export class ImportDiscovery {

	static readonly fileCache:       Map<string, t.File> = new Map();
	static readonly definitionCache: Map<string, ElementDefinition> = new Map();

	protected readonly log:          Logger<never, boolean>;
	protected readonly visitedFiles: Set<string> = new Set();

	constructor(
		protected readonly config: ImportDiscoveryConfig = {},
		protected readonly fs: FileSystemAdapter = { existsSync, readFileSync },
		protected readonly resolver: ResolverAdapter = resolve,
	) {
		this.log = createLogger('import-discovery', this.config.debugMode ?? debugMode.value);
	}

	findElementDefinition(
		path: NodePath<t.JSXOpeningElement>,
	): ElementDefinition {
		const elementName = path.node.name;
		const currentFileName = getPathFilename(path);

		// Only handle JSXIdentifier (not JSXMemberExpression or JSXNamespacedName)
		if (!t.isJSXIdentifier(elementName)) {
			this.log.trace({
				elementType: elementName.type,
				fn:          'findElementDefinition',
			}, 'Unsupported JSX element type, skipping');


			return { type: 'unknown' };
		}

		const elementNameString = elementName.name;

		const cacheKey = this.getCallSiteKey(elementNameString, path);
		if (ImportDiscovery.definitionCache.has(cacheKey)) {
			this.log.trace({
				element: elementNameString,
				cacheKey,
				fn:      'findElementDefinition',
			}, 'Using cached definition');

			return ImportDiscovery.definitionCache.get(cacheKey)!;
		}

		if (!isComponent(elementNameString)) {
			this.log.trace({
				element: elementNameString,
				fn:      'findElementDefinition',
			}, 'Element name is not a component, skipping');

			return { type: 'unknown' };
		}

		this.log.debug({
			element: elementNameString,
			file:    currentFileName,
			fn:      'findElementDefinition',
		}, 'Starting element definition discovery');

		const startTime = Date.now();
		const result = this.traceElementDefinition(elementNameString, path.scope, currentFileName);
		const duration = Date.now() - startTime;

		ImportDiscovery.definitionCache.set(cacheKey, result);

		this.log.debug({
			element:      elementNameString,
			result:       result.type,
			source:       result.source,
			originalName: result.originalName,
			localName:    result.localName,
			duration:     `${ duration }ms`,
			fn:           'findElementDefinition',
		}, 'Element definition discovery completed');

		return result;
	}

	// Generate a unique cache key for each call site
	protected getCallSiteKey(
		elementName: string,
		path: NodePath<t.JSXOpeningElement>,
	): string {
		const filename = getPathFilename(path);
		const node = path.node;

		// Use source location if available for precise call site identification
		if (node.loc)
			return `${ filename }:${ node.loc.start.line }:${ node.loc.start.column }:${ elementName }`;

		// Fallback to byte positions
		if (typeof node.start === 'number')
			return `${ filename }:${ node.start }:${ elementName }`;

		// Last resort: use path structure
		const pathKeys = [];
		let current: NodePath = path;
		while (current.parent) {
			pathKeys.unshift(`${ current.key }:${ current.listKey || '' }`);
			current = current.parentPath!;
		}

		return `${ filename }:${ pathKeys.join('/') }:${ elementName }`;
	}

	protected traceElementDefinition(
		elementName: string,
		scope: Scope,
		currentFileName: string,
	): ElementDefinition {
		const traceKey = `${ currentFileName }:${ elementName }`;
		// Prevent infinite recursion
		if (this.visitedFiles.has(traceKey)) {
			this.log.warn({
				traceKey,
				fn: 'traceElementDefinition',
			}, 'Circular reference detected, stopping trace');

			return { type: 'unknown' };
		}

		this.visitedFiles.add(traceKey);

		this.log.debug({
			element:      elementName,
			file:         currentFileName,
			visitedCount: this.visitedFiles.size,
			fn:           'traceElementDefinition',
		}, 'Tracing element definition');

		// Check if there's a binding for this identifier in the current scope
		const binding = scope.getBinding(elementName);

		if (!binding) {
			this.log.debug({
				element: elementName,
				fn:      'traceElementDefinition',
			}, 'No binding found for element');

			return { type: 'unknown' };
		}

		this.log.trace({
			element:  elementName,
			kind:     binding.kind,
			pathType: binding.path.type,
			fn:       'traceElementDefinition',
		}, 'Found binding');

		// Handle imports
		if (binding.kind === 'module' && t.isImportSpecifier(binding.path.node)) {
			this.log.debug({
				element: elementName,
				fn:      'traceElementDefinition',
			}, 'Tracing import binding');

			return this.traceImport(binding, currentFileName, elementName);
		}

		// Handle local variables/constants
		if (binding.kind === 'const' || binding.kind === 'let' || binding.kind === 'var') {
			this.log.debug({
				element: elementName,
				kind:    binding.kind,
				fn:      'traceElementDefinition',
			}, 'Tracing local variable binding');

			return this.traceLocalVariable(binding, currentFileName);
		}

		this.log.debug({
			element: elementName,
			kind:    binding.kind,
			fn:      'traceElementDefinition',
		}, 'Unsupported binding type');

		return { type: 'unknown' };
	}


	protected traceImport(
		binding: Binding,
		currentFileName: string,
		elementName: string,
	): ElementDefinition {
		this.log.debug({
			element: elementName,
			file:    currentFileName,
			fn:      'traceImport',
		}, 'Tracing import');

		const importDeclaration = binding.path.parent;

		if (!t.isImportDeclaration(importDeclaration)) {
			this.log.warn({
				element: elementName,
				fn:      'traceImport',
			}, 'Expected ImportDeclaration but got different type');

			return { type: 'unknown' };
		}

		// Get the original exported name from the import specifier
		const importSpecifier = binding.path.node;
		if (!t.isImportSpecifier(importSpecifier)) {
			this.log.warn({
				element: elementName,
				fn:      'traceImport',
			}, 'Expected ImportSpecifier but got different type');

			return { type: 'unknown' };
		}

		// The imported name is what we need to look for in the source file
		const originalExportedName = t.isIdentifier(importSpecifier.imported)
			? importSpecifier.imported.name
			: importSpecifier.imported.value;

		const importSource = importDeclaration.source.value;
		const currentDir = dirname(currentFileName);

		const resolvedResult = resolve.sync(currentDir, importSource);
		const resolvedPath = resolvedResult.path!;

		if (!resolvedPath) {
			this.log.warn({
				source: importSource,
				currentDir,
				fn:     'traceImport',
			}, 'Failed to resolve import path');

			return { type: 'unknown' };
		}

		this.log.debug({
			localName:    elementName,
			importedName: originalExportedName,
			source:       importSource,
			resolvedPath,
			fn:           'traceImport',
		}, 'Import mapping resolved');

		// Use cached parsing
		const ast = this.getOrParseFile(resolvedPath);
		if (!ast) {
			this.log.warn({
				resolvedPath,
				fn: 'traceImport',
			}, 'Failed to parse imported file');

			return { type: 'unknown' };
		}

		let result: ElementDefinition = { type: 'unknown' };

		traverse(ast, {
			Program: (programPath) => {
				// Look for the original exported name in the imported file
				const localBinding = programPath.scope.getBinding(originalExportedName);

				if (localBinding) {
					this.log.debug({
						name: originalExportedName,
						fn:   'traceImport',
					}, 'Found local binding in imported file');

					result = this.traceElementDefinition(
						originalExportedName,
						programPath.scope,
						resolvedPath,
					);

					// Add the import mapping information to the result
					if (result.type !== 'unknown') {
						result.originalName = originalExportedName;
						result.localName = elementName;
					}

					// Exit the traversal
					return programPath.stop();
				}

				this.log.debug({
					name: originalExportedName,
					fn:   'traceImport',
				}, 'No local binding found, checking for re-exports');

				// If no local binding found, check for re-exports
				result = this.checkForReExports(
					programPath,
					originalExportedName,
					resolvedPath,
				);
			},
		});

		return result;
	}

	protected traceLocalVariable(
		binding: Binding,
		currentFileName: string,
	): ElementDefinition {
		this.log.trace({
			kind:     binding.kind,
			pathType: binding.path.type,
			fn:       'traceLocalVariable',
		}, 'Tracing local variable');

		// Check if it's a variable declarator (const/let/var)
		if (!t.isVariableDeclarator(binding.path.node)) {
			this.log.trace({
				fn: 'traceLocalVariable',
			}, 'Local variable with no recognized pattern');

			return { type: 'local-variable' };
		}

		const declarator = binding.path.node;

		if (!declarator.init) {
			this.log.trace({
				fn: 'traceLocalVariable',
			}, 'Local variable has no initializer');

			return { type: 'local-variable' };
		}

		this.log.trace({
			initType: declarator.init.type,
			fn:       'traceLocalVariable',
		}, 'Checking local variable assignment type');

		// Check if it's assigned to a call expression
		if (t.isCallExpression(declarator.init)) {
			const callExpr = declarator.init;

			// Check if it's a toComponent/toTag call (accounting for renamed imports)
			if (this.isToComponentOrTagCall(callExpr, binding.path.scope)) {
				this.log.debug({
					callee: t.isIdentifier(callExpr.callee)
						? callExpr.callee.name
						: 'unknown',
					file: currentFileName,
					fn:   'traceLocalVariable',
				}, 'Found toComponent/toTag call assignment');

				return {
					type:           'custom-element',
					source:         currentFileName,
					callExpression: callExpr,
				};
			}

			// Could be assigned to another function call - trace that too
			this.log.trace({
				callee: t.isIdentifier(callExpr.callee)
					? callExpr.callee.name
					: callExpr.callee.type,
				fn: 'traceLocalVariable',
			}, 'Local variable assigned to call expression');

			// Add debug info if we're not continuing the trace
			this.log.debug({
				callee: t.isIdentifier(callExpr.callee)
					? callExpr.callee.name
					: 'unknown',
				file: currentFileName,
				fn:   'traceLocalVariable',
			}, 'Found non-toComponent/toTag call expression, stopping trace');
		}

		// Check if it's assigned to an identifier (another variable)
		if (t.isIdentifier(declarator.init)) {
			const assignedIdentifier = declarator.init.name;

			this.log.trace({
				to: t.isIdentifier(declarator.id)
					? declarator.id.name
					: 'unknown',
				from: assignedIdentifier,
				fn:   'traceLocalVariable',
			}, 'Following variable assignment chain');

			// Recursively trace this identifier in the same scope
			return this.traceElementDefinition(
				assignedIdentifier,
				binding.path.scope,
				currentFileName,
			);
		}

		return { type: 'local-variable' };
	}

	protected checkForReExports(
		programPath: babel.NodePath<babel.types.Program>,
		elementName: string,
		currentFileName: string,
	): ElementDefinition {
		this.log.debug({
			element: elementName,
			file:    currentFileName,
			fn:      'checkForReExports',
		}, 'Checking for re-exports');

		let result: ElementDefinition = { type: 'unknown' };

		// Check all export declarations for re-exports
		programPath.traverse({
			ExportNamedDeclaration: (exportPath) => {
				const node = exportPath.node;

				// Handle re-exports with source: export { X } from './file'
				if (node.source) {
					this.log.trace({
						source: node.source.value,
						fn:     'checkForReExports',
					}, 'Found re-export with source');

					for (const specifier of node.specifiers) {
						if (!t.isExportSpecifier(specifier)) {
							this.log.trace({
								specifierType: specifier.type,
								fn:            'checkForReExports',
							}, 'Skipping non-export specifier in re-export');

							continue; // Only handle export specifiers
						}

						const exportedName = t.isIdentifier(specifier.exported)
							? specifier.exported.name
							: specifier.exported.value;

						// Check if this re-export matches our element name
						if (exportedName !== elementName)
							continue;

						const originalName = specifier.local.name;

						this.log.debug({
							originalName,
							exportedName,
							source: node.source.value,
							fn:     'checkForReExports',
						}, 'Found matching re-export');

						// Resolve and trace the re-exported file
						const reExportSource = node.source.value;
						const currentDir = dirname(currentFileName);

						const resolvedResult = resolve.sync(currentDir, reExportSource);
						const resolvedPath = resolvedResult.path!;

						if (!existsSync(resolvedPath)) {
							this.log.warn({
								path: resolvedPath,
								fn:   'checkForReExports',
							}, 'Re-export target file not found');

							continue; // Skip if file doesn't exist
						}

						this.log.debug({
							resolvedPath,
							fn: 'checkForReExports',
						}, 'Tracing re-export to file');

						result = this.traceReExport(originalName, resolvedPath);

						// Add the re-export mapping information to the result
						if (result.type !== 'unknown') {
							result.originalName = originalName;
							result.localName = exportedName;
						}

						// Stop traversing once we find the match
						return exportPath.stop();
					}
				}
				// Handle local exports without source: export { v as BadgeCmp }
				else {
					this.log.trace({
						fn: 'checkForReExports',
					}, 'Found local export without source');

					for (const specifier of node.specifiers) {
						if (!t.isExportSpecifier(specifier)) {
							this.log.trace({
								specifierType: specifier.type,
								fn:            'checkForReExports',
							}, 'Skipping non-export specifier in local export');

							continue; // Only handle export specifiers
						}

						const exportedName = t.isIdentifier(specifier.exported)
							? specifier.exported.name
							: specifier.exported.value;

						// Check if this local export matches our element name
						if (exportedName !== elementName)
							continue;

						const localName = specifier.local.name;

						this.log.debug({
							localName,
							exportedName,
							fn: 'checkForReExports',
						}, 'Found matching local export');

						// Trace the local variable in the current file
						result = this.traceElementDefinition(
							localName,
							programPath.scope,
							currentFileName,
						);

						// Add the export mapping information to the result
						if (result.type !== 'unknown') {
							result.originalName = localName;
							result.localName = exportedName;
						}

						// Stop traversing once we find the match
						return exportPath.stop();
					}
				}
			},
		});

		this.log.debug({
			element:    elementName,
			resultType: result.type,
			fn:         'checkForReExports',
		}, 'Re-export check completed');

		return result;
	}

	protected traceReExport(
		elementName: string,
		filePath: string,
	): ElementDefinition {
		this.log.debug({
			elementName,
			filePath,
			fn: 'traceReExport',
		}, 'Tracing re-export');

		// Use cached parsing
		const ast = this.getOrParseFile(filePath);
		if (!ast) {
			this.log.warn({
				path: filePath,
				fn:   'traceReExport',
			}, 'Failed to parse re-export file');

			return { type: 'unknown' };
		}

		let result: ElementDefinition = { type: 'unknown' };

		traverse(ast, {
			Program: (programPath) => {
				// Continue tracing in the re-exported file
				result = this.traceElementDefinition(elementName, programPath.scope, filePath);
				programPath.stop();
			},
		});

		return result;
	}

	// Helper function to get or parse a file with caching
	protected getOrParseFile(filePath: string): t.File | undefined {
		// Check cache first
		if (ImportDiscovery.fileCache.has(filePath)) {
			this.log.trace({
				path: filePath,
				fn:   'getOrParseFile',
			}, 'Using cached AST');

			return ImportDiscovery.fileCache.get(filePath)!;
		}

		// File not in cache, parse it
		if (!existsSync(filePath)) {
			this.log.warn({
				path: filePath,
				fn:   'getOrParseFile',
			}, 'File does not exist');

			return;
		}

		const fileContent = readFileSync(filePath, 'utf-8');

		try {
			const ast = babel.parseSync(fileContent, {
				filename:   filePath,
				parserOpts: {
					plugins: babelPlugins,
				},
			});

			if (ast) {
				this.log.trace({
					path: filePath,
					fn:   'getOrParseFile',
				}, 'Parsed and cached file');

				ImportDiscovery.fileCache.set(filePath, ast);

				return ast;
			}
		}
		catch (error) {
			this.log.error({
				path:  filePath,
				error: String(error),
				fn:    'getOrParseFile',
			}, 'Failed to parse file');
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
			this.log.trace({
				function: functionName,
				fn:       'isToComponentOrTagCall',
			}, 'Found direct function call');

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
			this.log.trace({
				originalName: originalImportedName,
				localName:    functionName,
				fn:           'isToComponentOrTagCall',
			}, 'Found renamed function call');
		}

		return isOriginallyToComponentOrTag;
	}

}


//export function findElementDefinition(
//	path: NodePath<t.JSXOpeningElement>,
//	config?: ImportDiscoveryConfig,
//): ElementDefinition {
//	console.time('findElementDefinition');
//	const discovery = new ImportDiscovery(config);

//	const result = discovery.findElementDefinition(path);
//	console.timeEnd('findElementDefinition');

//	return result;
//}

const discovery = new ImportDiscovery();
export const findElementDefinition = (path: NodePath<t.JSXOpeningElement>): ElementDefinition => {
	console.time('findElementDefinition');

	const result = discovery.findElementDefinition(path);

	console.timeEnd('findElementDefinition');

	return result;
};
