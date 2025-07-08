import { existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

import * as babel from '@babel/core';
import type { Binding, NodePath,  Scope } from '@babel/traverse';
import * as t from '@babel/types';
import resolve from 'oxc-resolver';

import { traverse } from './babel-traverse.ts';
import { getPathFilename, isComponent } from './compiler-utils.ts';
import { createLogger } from './create-logger.ts';

export type BabelPlugins = NonNullable<NonNullable<babel.TransformOptions['parserOpts']>['plugins']>;


export interface ElementDefinition {
	type:            'custom-element' | 'import' | 'local-variable' | 'unknown';
	source?:         string; // file path for imports
	originalName?:   string; // for imports/re-exports
	localName?:      string; // the name used locally (for debugging rename chains)
	callExpression?: t.CallExpression; // for toJSX calls
}

const log = createLogger('import-discovery', true);


// Cache for parsed files to avoid re-parsing
const fileCache: Map<string, t.File> = new Map();


// Helper function to find the definition of a JSX element
export function findElementDefinition(
	path: NodePath<t.JSXOpeningElement>,
): ElementDefinition {
	fileCache.clear(); // Clear cache for fresh discovery

	const elementName = path.node.name;
	const currentFileName = getPathFilename(path);

	// Only handle JSXIdentifier (not JSXMemberExpression or JSXNamespacedName)
	if (!t.isJSXIdentifier(elementName))
		return { type: 'unknown' };

	const elementNameString = elementName.name;
	if (!isComponent(elementNameString))
		return { type: 'unknown' };

	log.debug({
		element: elementNameString,
		file:    currentFileName,
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
		log.warn({ traceKey }, 'Circular reference detected, stopping trace');

		return { type: 'unknown' };
	}

	visitedFiles.add(traceKey);

	log.debug({
		element:      elementName,
		file:         currentFileName,
		visitedCount: visitedFiles.size,
	}, 'Tracing element definition');

	// Check if there's a binding for this identifier in the current scope
	const binding = scope.getBinding(elementName);

	if (!binding) {
		log.debug({ element: elementName }, 'No binding found for element');

		return { type: 'unknown' };
	}

	log.trace({
		element:  elementName,
		kind:     binding.kind,
		pathType: binding.path.type,
	}, 'Found binding');

	// Handle imports
	if (binding.kind === 'module' && t.isImportSpecifier(binding.path.node)) {
		log.debug({ element: elementName }, 'Tracing import binding');

		return traceImport(binding, currentFileName, elementName, visitedFiles);
	}

	// Handle local variables/constants
	if (binding.kind === 'const' || binding.kind === 'let' || binding.kind === 'var') {
		log.debug({ element: elementName, kind: binding.kind }, 'Tracing local variable binding');

		return traceLocalVariable(binding, currentFileName, visitedFiles);
	}

	log.debug({ element: elementName, kind: binding.kind }, 'Unsupported binding type');

	return { type: 'unknown' };
}


function traceImport(
	binding: Binding,
	currentFileName: string,
	elementName: string,
	visitedFiles: Set<string>,
): ElementDefinition {
	log.debug({ element: elementName, file: currentFileName }, 'Tracing import');

	const importDeclaration = binding.path.parent;

	if (!t.isImportDeclaration(importDeclaration)) {
		log.warn({ element: elementName }, 'Expected ImportDeclaration but got different type');

		return { type: 'unknown' };
	}

	// Get the original exported name from the import specifier
	const importSpecifier = binding.path.node;
	if (!t.isImportSpecifier(importSpecifier)) {
		log.warn({ element: elementName }, 'Expected ImportSpecifier but got different type');

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

	log.debug({
		localName:    elementName,
		importedName: originalExportedName,
		source:       importSource,
		resolvedPath,
	}, 'Import mapping resolved');

	// Use cached parsing
	const ast = getOrParseFile(resolvedPath);
	if (!ast) {
		log.warn({ resolvedPath }, 'Failed to parse imported file');

		return { type: 'unknown' };
	}

	let result: ElementDefinition = { type: 'unknown' };

	traverse(ast, {
		Program(programPath) {
			// Look for the original exported name in the imported file
			const localBinding = programPath.scope.getBinding(originalExportedName);

			if (localBinding) {
				log.debug({ name: originalExportedName }, 'Found local binding in imported file');

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

			log.debug({ name: originalExportedName }, 'No local binding found, checking for re-exports');

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
	log.trace({ kind: binding.kind, pathType: binding.path.type }, 'Tracing local variable');

	// Check if it's a variable declarator (const/let/var)
	if (t.isVariableDeclarator(binding.path.node)) {
		const declarator = binding.path.node;

		// Check if it's assigned to a call expression
		if (declarator.init && t.isCallExpression(declarator.init)) {
			const callExpr = declarator.init;

			// Check if it's a toComponent/toTag call (accounting for renamed imports)
			if (isToComponentOrTagCall(callExpr, binding.path.scope)) {
				log.debug({
					file:   currentFileName,
					callee: t.isIdentifier(callExpr.callee) ? callExpr.callee.name : 'unknown',
				}, 'Found toComponent/toTag call assignment');

				return {
					type:           'custom-element',
					source:         currentFileName,
					callExpression: callExpr,
				};
			}

			// Could be assigned to another function call - trace that too
			log.trace({
				callee: t.isIdentifier(callExpr.callee) ? callExpr.callee.name : callExpr.callee.type,
			}, 'Local variable assigned to call expression');
		}

		// Check if it's assigned to an identifier (another variable)
		if (declarator.init && t.isIdentifier(declarator.init)) {
			const assignedIdentifier = declarator.init.name;

			log.debug({
				from: assignedIdentifier,
				to:   t.isIdentifier(declarator.id) ? declarator.id.name : 'unknown',
			}, 'Following variable assignment chain');

			// Recursively trace this identifier in the same scope
			return traceElementDefinition(
				assignedIdentifier,
				binding.path.scope,
				currentFileName,
				visitedFiles,
			);
		}
	}

	log.trace('Local variable with no recognized pattern');

	return { type: 'local-variable' };
}


function checkForReExports(
	programPath: babel.NodePath<babel.types.Program>,
	elementName: string,
	currentFileName: string,
	visitedFiles: Set<string>,
): ElementDefinition {
	log.debug({ element: elementName, file: currentFileName }, 'Checking for re-exports');

	let result: ElementDefinition = { type: 'unknown' };

	// Check all export declarations for re-exports
	programPath.traverse({
		ExportNamedDeclaration(exportPath) {
			const node = exportPath.node;

			// Handle re-exports with source: export { X } from './file'
			if (node.source && node.specifiers) {
				log.trace({ source: node.source.value }, 'Found re-export with source');

				for (const specifier of node.specifiers) {
					if (!t.isExportSpecifier(specifier))
						continue; // Only handle export specifiers

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
					}, 'Found matching re-export');

					// Resolve and trace the re-exported file
					const reExportSource = node.source.value;
					const currentDir = dirname(currentFileName);

					const resolvedResult = resolve.sync(currentDir, reExportSource);
					const resolvedPath = resolvedResult.path!;

					if (!existsSync(resolvedPath)) {
						log.warn({ path: resolvedPath }, 'Re-export target file not found');
						continue; // Skip if file doesn't exist
					}

					log.debug({ resolvedPath }, 'Tracing re-export to file');

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
			else if (!node.source && node.specifiers) {
				log.trace('Found local export without source');

				for (const specifier of node.specifiers) {
					if (!t.isExportSpecifier(specifier))
						continue; // Only handle export specifiers

					const exportedName = t.isIdentifier(specifier.exported)
						? specifier.exported.name
						: specifier.exported.value;

					// Check if this local export matches our element name
					if (exportedName !== elementName)
						continue;

					const localName = specifier.local.name;

					log.debug({ localName, exportedName }, 'Found matching local export');

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

	log.debug({ element: elementName, resultType: result.type }, 'Re-export check completed');

	return result;
}


function traceReExport(
	elementName: string,
	filePath: string,
	visitedFiles: Set<string>,
): ElementDefinition {
	log.debug({ elementName, filePath }, 'Tracing re-export');

	// Use cached parsing
	const ast = getOrParseFile(filePath);
	if (!ast) {
		log.warn({ path: filePath }, 'Failed to parse re-export file');

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
		log.trace({ path: filePath }, 'Using cached AST');

		return fileCache.get(filePath)!;
	}

	// File not in cache, parse it
	if (!existsSync(filePath)) {
		log.warn({ path: filePath }, 'File does not exist');

		return;
	}

	const fileContent = readFileSync(filePath, 'utf-8');

	try {
		const ast = babel.parseSync(fileContent, {
			filename:   filePath,
			parserOpts: {
				plugins: [
					'jsx',
					'typescript',
					'decorators',
					'decoratorAutoAccessors',
				] satisfies BabelPlugins,
			},
		});

		if (ast) {
			log.trace({ path: filePath }, 'Parsed and cached file');
			fileCache.set(filePath, ast);

			return ast;
		}
	}
	catch (error) {
		log.error({ path: filePath, error: String(error) }, 'Failed to parse file');
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
		log.trace({ function: functionName }, 'Found direct function call');

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
	const isOriginallyToComponentOrTag = originalImportedName === 'toComponent' || originalImportedName === 'toTag';

	if (isOriginallyToComponentOrTag) {
		log.trace({
			originalName: originalImportedName,
			localName:    functionName,
		}, 'Found renamed function call');
	}

	return isOriginallyToComponentOrTag;
}
