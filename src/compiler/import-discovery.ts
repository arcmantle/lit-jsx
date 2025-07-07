import { existsSync, readFileSync } from 'node:fs';
import { dirname /*resolve as nodeResolve*/ } from 'node:path';

import * as babel from '@babel/core';
import type { Binding, NodePath,  Scope } from '@babel/traverse';
import * as t from '@babel/types';
import resolve from 'oxc-resolver';

import { traverse } from './babel-traverse.ts';
import { getPathFilename, isComponent } from './compiler-utils.ts';


export type BabelPlugins = NonNullable<NonNullable<babel.TransformOptions['parserOpts']>['plugins']>;


// Types for our discovery results
export interface ElementDefinition {
	type:            'custom-element' | 'import' | 'local-variable' | 'unknown';
	source?:         string; // file path for imports
	originalName?:   string; // for imports/re-exports
	callExpression?: t.CallExpression; // for toJSX calls
}


// Cache for parsed files to avoid re-parsing
const fileCache: Map<string, t.File> = new Map();

let debuggingEnabled = false;


// Helper function to find the definition of a JSX element
export function findElementDefinition(
	path: NodePath<t.JSXOpeningElement>,
	enableDebugging?: boolean,
): ElementDefinition {
	if (enableDebugging)
		debuggingEnabled = true;

	fileCache.clear(); // Clear cache for fresh discovery

	const elementName = path.node.name;
	const currentFileName = getPathFilename(path);

	// Only handle JSXIdentifier (not JSXMemberExpression or JSXNamespacedName)
	if (!t.isJSXIdentifier(elementName))
		return { type: 'unknown' };

	const elementNameString = elementName.name;
	if (!isComponent(elementNameString))
		return { type: 'unknown' };

	if (debuggingEnabled)
		console.log('Tracing element:', elementNameString);

	// Start tracing with the current file context
	return traceElementDefinition(elementNameString, path.scope, currentFileName);
}

// Core recursive tracing function
function traceElementDefinition(
	elementName: string,
	scope: Scope,
	currentFileName: string,
	visitedFiles: Set<string> = new Set(),
): ElementDefinition {
	// Prevent infinite recursion
	if (visitedFiles.has(`${ currentFileName }:${ elementName }`))
		return { type: 'unknown' };

	visitedFiles.add(`${ currentFileName }:${ elementName }`);

	// Check if there's a binding for this identifier in the current scope
	const binding = scope.getBinding(elementName);

	if (!binding) {
		if (debuggingEnabled)
			console.log('No binding found for:', elementName);

		return { type: 'unknown' };
	}

	if (debuggingEnabled)
		console.log('Binding kind:', binding.kind, 'type:', binding.path.type);

	// Handle imports
	if (binding.kind === 'module' && t.isImportSpecifier(binding.path.node))
		return traceImport(binding, currentFileName, elementName, visitedFiles);


	// Handle local variables/constants
	if (binding.kind === 'const' || binding.kind === 'let' || binding.kind === 'var')
		return traceLocalVariable(binding, currentFileName, visitedFiles);


	return { type: 'unknown' };
}


function traceImport(
	binding: Binding,
	currentFileName: string,
	elementName: string,
	visitedFiles: Set<string>,
): ElementDefinition {
	const importDeclaration = binding.path.parent;

	if (!t.isImportDeclaration(importDeclaration))
		return { type: 'unknown' };

	const importSource = importDeclaration.source.value;
	const currentDir = dirname(currentFileName);
	//const resolvedPath2 = nodeResolve(currentDir, importSource);

	const resolvedResult = resolve.sync(currentDir, importSource);
	const resolvedPath = resolvedResult.path!;

	console.log(resolvedResult);

	if (debuggingEnabled) {
		console.log('Tracing import from:', importSource);
		console.log('Resolved to:', resolvedPath);
	}

	// Use cached parsing
	const ast = getOrParseFile(resolvedPath);
	if (!ast) {
		if (debuggingEnabled)
			console.log('Failed to parse imported file:', resolvedPath);

		return { type: 'unknown' };
	}

	let result: ElementDefinition = { type: 'unknown' };

	traverse(ast, {
		Program(programPath) {
			// First try to find a local binding (normal export)
			const localBinding = programPath.scope.getBinding(elementName);

			// TODO, we need to account for things having been minified and renamed
			// like `export { X as Y } from './file'`
			// As well as the toComponent/toTag calls having been renamed.

			if (localBinding) {
				if (debuggingEnabled)
					console.log('Found local binding in imported file');

				result = traceElementDefinition(elementName, programPath.scope, resolvedPath, visitedFiles);

				return;
			}

			if (debuggingEnabled)
				console.log('No local binding, checking for re-exports...');

			// If no local binding found, check for re-exports
			result = checkForReExports(programPath, elementName, resolvedPath, visitedFiles);
		},
	});

	return result;
}


function traceLocalVariable(
	binding: Binding,
	currentFileName: string,
	visitedFiles: Set<string>,
): ElementDefinition {
	if (debuggingEnabled)
		console.log('Tracing local variable:', binding.kind, binding.path.type);

	// Check if it's a variable declarator (const/let/var)
	if (t.isVariableDeclarator(binding.path.node)) {
		const declarator = binding.path.node;

		// Check if it's assigned to a call expression
		if (declarator.init && t.isCallExpression(declarator.init)) {
			const callExpr = declarator.init;

			// Check if it's a toJSX call
			if (t.isIdentifier(callExpr.callee)
				&& (callExpr.callee.name === 'toComponent' || callExpr.callee.name === 'toTag')
			) {
				return {
					type:           'custom-element',
					source:         currentFileName,
					callExpression: callExpr,
				};
			}

			// Could be assigned to another function call - trace that too
			if (debuggingEnabled)
				console.log('Local variable assigned to call expression:', callExpr.callee);
		}

		// Check if it's assigned to an identifier (another variable)
		if (declarator.init && t.isIdentifier(declarator.init)) {
			const assignedIdentifier = declarator.init.name;

			if (debuggingEnabled)
				console.log('Local variable assigned to identifier:', assignedIdentifier);

			// Recursively trace this identifier in the same scope
			return traceElementDefinition(assignedIdentifier, binding.path.scope, currentFileName, visitedFiles);
		}
	}

	return { type: 'local-variable' };
}


function checkForReExports(
	programPath: babel.NodePath<babel.types.Program>,
	elementName: string,
	currentFileName: string,
	visitedFiles: Set<string>,
): ElementDefinition {
	let result: ElementDefinition = { type: 'unknown' };

	// Check all export declarations for re-exports
	programPath.traverse({
		ExportNamedDeclaration(exportPath) {
			const node = exportPath.node;

			if (!node.source || !node.specifiers)
				return; // Skip if no source or specifiers

			// Handle re-exports: export { X } from './file'
			if (debuggingEnabled)
				console.log('Found re-export from:', node.source.value);

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

				if (debuggingEnabled)
					console.log(`Found re-export: ${ originalName } as ${ exportedName }`);

				// Resolve and trace the re-exported file
				const reExportSource = node.source.value;
				const currentDir = dirname(currentFileName);
				//const resolvedPath2 = nodeResolve(currentDir, reExportSource);

				const resolvedResult = resolve.sync(currentDir, reExportSource);
				const resolvedPath = resolvedResult.path!;

				if (!existsSync(resolvedPath))
					continue; // Skip if file doesn't exist

				if (debuggingEnabled)
					console.log('Tracing re-export to:', resolvedPath);

				result = traceReExport(originalName, resolvedPath, visitedFiles);

				// Stop traversing once we find the match
				return exportPath.stop();
			}
		},
	});

	return result;
}


function traceReExport(
	elementName: string,
	filePath: string,
	visitedFiles: Set<string>,
): ElementDefinition {
	// Use cached parsing
	const ast = getOrParseFile(filePath);
	if (!ast)
		return { type: 'unknown' };

	let result: ElementDefinition = { type: 'unknown' };

	traverse(ast, {
		Program(programPath) {
			// Continue tracing in the re-exported file
			result = traceElementDefinition(elementName, programPath.scope, filePath, visitedFiles);
		},
	});

	return result;
}


// Helper function to get or parse a file with caching
function getOrParseFile(filePath: string): t.File | undefined {
	// Check cache first
	if (fileCache.has(filePath)) {
		if (debuggingEnabled)
			console.log('Using cached AST for:', filePath);

		return fileCache.get(filePath)!;
	}

	// File not in cache, parse it
	if (!existsSync(filePath))
		return;

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
			if (debuggingEnabled)
				console.log('Parsed and cached:', filePath);

			fileCache.set(filePath, ast);

			return ast;
		}
	}
	catch (error) {
		console.log('Failed to parse file:', filePath, error);
	}
}
