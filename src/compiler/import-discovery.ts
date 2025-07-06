import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import * as babel from '@babel/core';
import traverse, { Binding, Hub, NodePath, Scope } from '@babel/traverse';
import * as t from '@babel/types';


// Cache for parsed files to avoid re-parsing
const fileCache: Map<string, t.File> = new Map();


export type BabelPlugins = NonNullable<NonNullable<babel.TransformOptions['parserOpts']>['plugins']>;


// Types for our discovery results
export interface ElementDefinition {
	type:            'custom-element' | 'import' | 'local-variable' | 'unknown';
	source?:         string; // file path for imports
	originalName?:   string; // for imports/re-exports
	callExpression?: t.CallExpression; // for toJSX calls
}


// Helper function to find the definition of a JSX element
export function findElementDefinition(path: NodePath<t.JSXOpeningElement>): ElementDefinition {
	const elementName = path.node.name;

	const hub = path.hub as Hub & { file: { opts: { filename: string; }; }; };

	const currentFileName = hub.file.opts.filename;

	// Only handle JSXIdentifier (not JSXMemberExpression or JSXNamespacedName)
	if (!t.isJSXIdentifier(elementName))
		return { type: 'unknown' };

	const elementNameString = elementName.name;

	//console.log('Tracing element:', elementNameString);

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
		//console.log('No binding found for:', elementName);

		return { type: 'unknown' };
	}

	//console.log('Binding kind:', binding.kind, 'type:', binding.path.type);

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
	const resolvedPath = resolve(currentDir, importSource);

	//console.log('Tracing import from:', importSource);
	//console.log('Resolved to:', resolvedPath);

	// Use cached parsing
	const ast = getOrParseFile(resolvedPath);
	if (!ast)
		return { type: 'unknown' };


	let result: ElementDefinition = { type: 'unknown' };

	traverse(ast, {
		Program(programPath) {
			// First try to find a local binding (normal export)
			const localBinding = programPath.scope.getBinding(elementName);

			if (localBinding) {
				//console.log('Found local binding in imported file');
				result = traceElementDefinition(elementName, programPath.scope, resolvedPath, visitedFiles);

				return;
			}

			// If no local binding found, check for re-exports
			//console.log('No local binding, checking for re-exports...');
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
	//console.log('Tracing local variable:', binding.kind, binding.path.type);

	// Check if it's a variable declarator (const/let/var)
	if (t.isVariableDeclarator(binding.path.node)) {
		const declarator = binding.path.node;

		// Check if it's assigned to a call expression
		if (declarator.init && t.isCallExpression(declarator.init)) {
			const callExpr = declarator.init;

			// Check if it's a toJSX call
			if (t.isIdentifier(callExpr.callee) && callExpr.callee.name === 'toJSX') {
				return {
					type:           'custom-element',
					source:         currentFileName,
					callExpression: callExpr,
				};
			}

			// Could be assigned to another function call - trace that too
			//console.log('Local variable assigned to call expression:', callExpr.callee);
		}

		// Check if it's assigned to an identifier (another variable)
		if (declarator.init && t.isIdentifier(declarator.init)) {
			const assignedIdentifier = declarator.init.name;
			//console.log('Local variable assigned to identifier:', assignedIdentifier);

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
			//console.log('Found re-export from:', node.source.value);

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
				//console.log(`Found re-export: ${ originalName } as ${ exportedName }`);

				// Resolve and trace the re-exported file
				const reExportSource = node.source.value;
				const currentDir = dirname(currentFileName);
				const resolvedPath = resolve(currentDir, reExportSource);

				if (!existsSync(resolvedPath))
					continue; // Skip if file doesn't exist

				//console.log('Tracing re-export to:', resolvedPath);
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
		//console.log('Using cached AST for:', filePath);

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
				plugins: [ 'jsx', 'typescript' ] satisfies BabelPlugins,
			},
		});

		if (ast) {
			//console.log('Parsed and cached:', filePath);
			fileCache.set(filePath, ast);

			return ast;
		}
	}
	catch (error) {
		console.log('Failed to parse file:', filePath, error);
	}
}
