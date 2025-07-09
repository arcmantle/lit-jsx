import { existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

import * as babel from '@babel/core';
import type { Binding, NodePath, Scope } from '@babel/traverse';
import * as t from '@babel/types';
import resolve from 'oxc-resolver';
import type { Logger } from 'pino';

import { traverse } from './babel-traverse.ts';
import { getPathFilename, isComponent } from './compiler-utils.ts';
import { debugMode, plugins } from './config.ts';
import { createLogger } from './create-logger.ts';


export interface ElementDefinition {
	type:            'custom-element' | 'import' | 'local-variable' | 'unknown';
	source?:         string; // file path for imports
	originalName?:   string; // for imports/re-exports
	localName?:      string; // the name used locally (for debugging rename chains)
	callExpression?: t.CallExpression; // for toJSX calls
}


let log: Logger<never, boolean>;


// Cache for parsed files to avoid re-parsing
const fileCache: Map<string, t.File> = new Map();


// Helper function to find the definition of a JSX element
export function findElementDefinition(
	path: NodePath<t.JSXOpeningElement>,
): ElementDefinition {
	log ??= createLogger('import-discovery', debugMode.value);
	fileCache.clear(); // Clear cache for fresh discovery

	const elementName = path.node.name;
	const currentFileName = getPathFilename(path);

	// Only handle JSXIdentifier (not JSXMemberExpression or JSXNamespacedName)
	if (!t.isJSXIdentifier(elementName)) {
		log.trace({
			elementType: elementName.type,
			fn:          'findElementDefinition',
		}, 'Unsupported JSX element type, skipping');

		return { type: 'unknown' };
	}

	const elementNameString = elementName.name;
	if (!isComponent(elementNameString)) {
		log.trace({
			element: elementNameString,
			fn:      'findElementDefinition',
		}, 'Element name is not a component, skipping');

		return { type: 'unknown' };
	}

	log.debug({
		element: elementNameString,
		file:    currentFileName,
		fn:      'findElementDefinition',
	}, 'Starting element definition discovery');

	const startTime = Date.now();
	const result = traceElementDefinition(elementNameString, path.scope, currentFileName);
	const duration = Date.now() - startTime;

	log.debug({
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

// Core recursive tracing function
function traceElementDefinition(
	elementName: string,
	scope: Scope,
	currentFileName: string,
	visitedFiles: Set<string> = new Set(),
): ElementDefinition {
	const traceKey = `${ currentFileName }:${ elementName }`;
	// Prevent infinite recursion
	if (visitedFiles.has(traceKey)) {
		log.warn({
			traceKey,
			fn: 'traceElementDefinition',
		}, 'Circular reference detected, stopping trace');

		return { type: 'unknown' };
	}

	visitedFiles.add(traceKey);

	log.debug({
		element:      elementName,
		file:         currentFileName,
		visitedCount: visitedFiles.size,
		fn:           'traceElementDefinition',
	}, 'Tracing element definition');

	// Check if there's a binding for this identifier in the current scope
	const binding = scope.getBinding(elementName);

	if (!binding) {
		log.debug({
			element: elementName,
			fn:      'traceElementDefinition',
		}, 'No binding found for element');

		return { type: 'unknown' };
	}

	log.trace({
		element:  elementName,
		kind:     binding.kind,
		pathType: binding.path.type,
		fn:       'traceElementDefinition',
	}, 'Found binding');

	// Handle imports
	if (binding.kind === 'module' && t.isImportSpecifier(binding.path.node)) {
		log.debug({
			element: elementName,
			fn:      'traceElementDefinition',
		}, 'Tracing import binding');

		return traceImport(binding, currentFileName, elementName, visitedFiles);
	}

	// Handle local variables/constants
	if (binding.kind === 'const' || binding.kind === 'let' || binding.kind === 'var') {
		log.debug({
			element: elementName,
			kind:    binding.kind,
			fn:      'traceElementDefinition',
		}, 'Tracing local variable binding');

		return traceLocalVariable(binding, currentFileName, visitedFiles);
	}

	log.debug({
		element: elementName,
		kind:    binding.kind,
		fn:      'traceElementDefinition',
	}, 'Unsupported binding type');

	return { type: 'unknown' };
}


function traceImport(
	binding: Binding,
	currentFileName: string,
	elementName: string,
	visitedFiles: Set<string>,
): ElementDefinition {
	log.debug({
		element: elementName,
		file:    currentFileName,
		fn:      'traceImport',
	}, 'Tracing import');

	const importDeclaration = binding.path.parent;

	if (!t.isImportDeclaration(importDeclaration)) {
		log.warn({
			element: elementName,
			fn:      'traceImport',
		}, 'Expected ImportDeclaration but got different type');

		return { type: 'unknown' };
	}

	// Get the original exported name from the import specifier
	const importSpecifier = binding.path.node;
	if (!t.isImportSpecifier(importSpecifier)) {
		log.warn({
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
		log.warn({
			source: importSource,
			currentDir,
			fn:     'traceImport',
		}, 'Failed to resolve import path');

		return { type: 'unknown' };
	}

	log.debug({
		localName:    elementName,
		importedName: originalExportedName,
		source:       importSource,
		resolvedPath,
		fn:           'traceImport',
	}, 'Import mapping resolved');

	// Use cached parsing
	const ast = getOrParseFile(resolvedPath);
	if (!ast) {
		log.warn({
			resolvedPath,
			fn: 'traceImport',
		}, 'Failed to parse imported file');

		return { type: 'unknown' };
	}

	let result: ElementDefinition = { type: 'unknown' };

	traverse(ast, {
		Program(programPath) {
			// Look for the original exported name in the imported file
			const localBinding = programPath.scope.getBinding(originalExportedName);

			if (localBinding) {
				log.debug({
					name: originalExportedName,
					fn:   'traceImport',
				}, 'Found local binding in imported file');

				result = traceElementDefinition(
					originalExportedName,
					programPath.scope,
					resolvedPath,
					visitedFiles,
				);

				// Add the import mapping information to the result
				if (result.type !== 'unknown') {
					result.originalName = originalExportedName;
					result.localName = elementName;
				}

				// Exit the traversal
				return programPath.stop();
			}

			log.debug({
				name: originalExportedName,
				fn:   'traceImport',
			}, 'No local binding found, checking for re-exports');

			// If no local binding found, check for re-exports
			result = checkForReExports(
				programPath,
				originalExportedName,
				resolvedPath,
				visitedFiles,
			);
		},
	});

	return result;
}


function traceLocalVariable(
	binding: Binding,
	currentFileName: string,
	visitedFiles: Set<string>,
): ElementDefinition {
	log.trace({
		kind:     binding.kind,
		pathType: binding.path.type,
		fn:       'traceLocalVariable',
	}, 'Tracing local variable');

	// Check if it's a variable declarator (const/let/var)
	if (!t.isVariableDeclarator(binding.path.node)) {
		log.trace({
			fn: 'traceLocalVariable',
		}, 'Local variable with no recognized pattern');

		return { type: 'local-variable' };
	}

	const declarator = binding.path.node;

	if (!declarator.init) {
		log.trace({
			fn: 'traceLocalVariable',
		}, 'Local variable has no initializer');

		return { type: 'local-variable' };
	}

	log.trace({
		initType: declarator.init.type,
		fn:       'traceLocalVariable',
	}, 'Checking local variable assignment type');

	// Check if it's assigned to a call expression
	if (t.isCallExpression(declarator.init)) {
		const callExpr = declarator.init;

		// Check if it's a toComponent/toTag call (accounting for renamed imports)
		if (isToComponentOrTagCall(callExpr, binding.path.scope)) {
			log.debug({
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
		log.trace({
			callee: t.isIdentifier(callExpr.callee)
				? callExpr.callee.name
				: callExpr.callee.type,
			fn: 'traceLocalVariable',
		}, 'Local variable assigned to call expression');

		// Add debug info if we're not continuing the trace
		log.debug({
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

		log.trace({
			to: t.isIdentifier(declarator.id)
				? declarator.id.name
				: 'unknown',
			from: assignedIdentifier,
			fn:   'traceLocalVariable',
		}, 'Following variable assignment chain');

		// Recursively trace this identifier in the same scope
		return traceElementDefinition(
			assignedIdentifier,
			binding.path.scope,
			currentFileName,
			visitedFiles,
		);
	}

	return { type: 'local-variable' };
}


function checkForReExports(
	programPath: babel.NodePath<babel.types.Program>,
	elementName: string,
	currentFileName: string,
	visitedFiles: Set<string>,
): ElementDefinition {
	log.debug({
		element: elementName,
		file:    currentFileName,
		fn:      'checkForReExports',
	}, 'Checking for re-exports');

	let result: ElementDefinition = { type: 'unknown' };

	// Check all export declarations for re-exports
	programPath.traverse({
		ExportNamedDeclaration(exportPath) {
			const node = exportPath.node;

			// Handle re-exports with source: export { X } from './file'
			if (node.source) {
				log.trace({
					source: node.source.value,
					fn:     'checkForReExports',
				}, 'Found re-export with source');

				for (const specifier of node.specifiers) {
					if (!t.isExportSpecifier(specifier)) {
						log.trace({
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

					log.debug({
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
						log.warn({
							path: resolvedPath,
							fn:   'checkForReExports',
						}, 'Re-export target file not found');

						continue; // Skip if file doesn't exist
					}

					log.debug({
						resolvedPath,
						fn: 'checkForReExports',
					}, 'Tracing re-export to file');

					result = traceReExport(originalName, resolvedPath, visitedFiles);

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
				log.trace({
					fn: 'checkForReExports',
				}, 'Found local export without source');

				for (const specifier of node.specifiers) {
					if (!t.isExportSpecifier(specifier)) {
						log.trace({
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

					log.debug({
						localName,
						exportedName,
						fn: 'checkForReExports',
					}, 'Found matching local export');

					// Trace the local variable in the current file
					result = traceElementDefinition(
						localName,
						programPath.scope,
						currentFileName,
						visitedFiles,
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

	log.debug({
		element:    elementName,
		resultType: result.type,
		fn:         'checkForReExports',
	}, 'Re-export check completed');

	return result;
}


function traceReExport(
	elementName: string,
	filePath: string,
	visitedFiles: Set<string>,
): ElementDefinition {
	log.debug({
		elementName,
		filePath,
		fn: 'traceReExport',
	}, 'Tracing re-export');

	// Use cached parsing
	const ast = getOrParseFile(filePath);
	if (!ast) {
		log.warn({
			path: filePath,
			fn:   'traceReExport',
		}, 'Failed to parse re-export file');

		return { type: 'unknown' };
	}

	let result: ElementDefinition = { type: 'unknown' };

	traverse(ast, {
		Program(programPath) {
			// Continue tracing in the re-exported file
			result = traceElementDefinition(elementName, programPath.scope, filePath, visitedFiles);
			programPath.stop();
		},
	});

	return result;
}


// Helper function to get or parse a file with caching
function getOrParseFile(filePath: string): t.File | undefined {
	// Check cache first
	if (fileCache.has(filePath)) {
		log.trace({
			path: filePath,
			fn:   'getOrParseFile',
		}, 'Using cached AST');

		return fileCache.get(filePath)!;
	}

	// File not in cache, parse it
	if (!existsSync(filePath)) {
		log.warn({
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
				plugins: plugins.values().toArray(),
			},
		});

		if (ast) {
			log.trace({
				path: filePath,
				fn:   'getOrParseFile',
			}, 'Parsed and cached file');

			fileCache.set(filePath, ast);

			return ast;
		}
	}
	catch (error) {
		log.error({
			path:  filePath,
			error: String(error),
			fn:    'getOrParseFile',
		}, 'Failed to parse file');
	}
}


// Helper function to check if a call expression is a toComponent/toTag call
// even if the function has been renamed through imports
function isToComponentOrTagCall(
	callExpr: t.CallExpression,
	scope: Scope,
): boolean {
	if (!t.isIdentifier(callExpr.callee))
		return false;

	const functionName = callExpr.callee.name;

	// Check direct names first (fast path)
	if (functionName === 'toComponent' || functionName === 'toTag') {
		log.trace({
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
		log.trace({
			originalName: originalImportedName,
			localName:    functionName,
			fn:           'isToComponentOrTagCall',
		}, 'Found renamed function call');
	}

	return isOriginallyToComponentOrTag;
}
