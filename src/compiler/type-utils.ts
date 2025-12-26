import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import * as ts from 'typescript';

import { getSourceFile, getTypeChecker } from './ts-program-manager.js';


/**
 * Checks if a JSX element refers to a class or custom element based on TypeScript type information.
 *
 * Returns:
 * - `true` if the element is a class constructor or string literal (should be treated as static/custom element)
 * - `false` if the element is a function component (should be treated as dynamic)
 * - `undefined` if type checking is not available or the type cannot be determined
 */
export const isClassOrCustomElementByType = (
	path: NodePath<t.JSXElement>,
	filename: string,
): boolean | undefined => {
	const typeChecker = getTypeChecker();
	const sourceFile = getSourceFile(filename);

	// Try normalizing the path
	if (!sourceFile && filename) {
		const normalizedPath = filename.replace(/\\/g, '/');
		const altSourceFile = getSourceFile(normalizedPath);
		if (altSourceFile)
			return isClassOrCustomElementByType(path, normalizedPath);
	}

	if (!typeChecker || !sourceFile)
		return undefined; // Type checking not available

	// Get the tag name from the JSX element
	const openingElement = path.node.openingElement;
	if (!t.isJSXIdentifier(openingElement.name))
		return undefined;


	const tagName = openingElement.name.name;

	// First, try to find the symbol at the JSX usage location
	// This works for both local declarations and imports
	const identifier = findIdentifierInJSX(sourceFile, tagName);
	if (identifier) {
		const symbol = typeChecker.getSymbolAtLocation(identifier);

		if (symbol) {
			// Get the type of the symbol (this follows imports automatically)
			const type = typeChecker.getTypeOfSymbolAtLocation(symbol, identifier);

			return checkTypeForStaticOrDynamic(tagName, type, typeChecker);
		}
	}

	// Fallback: Find the declaration of this identifier in the TypeScript AST
	const declaration = findDeclarationByName(sourceFile, tagName);
	if (!declaration)
		return undefined;

	// Get the type at this location
	const type = typeChecker.getTypeAtLocation(declaration);
	if (!type)
		return undefined;

	return checkTypeForStaticOrDynamic(tagName, type, typeChecker);
};

/**
 * Helper function to check if a type represents a static element (class/string) or dynamic (function)
 */
function checkTypeForStaticOrDynamic(
	tagName: string,
	type: ts.Type,
	typeChecker: ts.TypeChecker,
): boolean | undefined {
	// Check if it's a string literal type (e.g., const MyElement = "my-element")
	if (type.flags & ts.TypeFlags.StringLiteral)
		return true;

	// Check if it's a class type
	if (type.symbol?.flags & ts.SymbolFlags.Class)
		return true;

	// Check if it has construct signatures (it's a constructor/class reference)
	const constructSignatures = typeChecker.getSignaturesOfType(type, ts.SignatureKind.Construct);
	if (constructSignatures.length > 0)
		return true;

	// Check if it has call signatures (it's a callable function)
	const callSignatures = typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call);
	if (callSignatures.length > 0) {
		// It's a function - check if the return type suggests it's a component
		// For now, we treat all functions as function components (dynamic)
		return false;
	}

	// If we can't determine, return undefined
	return undefined;
}

/**
 * Finds an identifier node in JSX by searching for JSX elements with that tag name.
 * This is useful for getting the symbol at the usage location (which works for imports).
 */
function findIdentifierInJSX(sourceFile: ts.SourceFile, name: string): ts.Identifier | undefined {
	let found: ts.Identifier | undefined;

	function visit(node: ts.Node): void {
		if (found)
			return;

		// Look for JSX elements with the matching tag name
		if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
			const tagNameNode = node.tagName;
			if (ts.isIdentifier(tagNameNode) && tagNameNode.text === name) {
				found = tagNameNode;

				return;
			}
		}

		ts.forEachChild(node, visit);
	}

	visit(sourceFile);

	return found;
}


/**
 * Finds a TypeScript AST node at a specific position in the source file.
 */
function _findNodeAtPosition(sourceFile: ts.SourceFile, pos: number): ts.Node | undefined {
	function find(node: ts.Node): ts.Node | undefined {
		if (pos >= node.getStart(sourceFile) && pos < node.getEnd())
			return ts.forEachChild(node, find) || node;

		return undefined;
	}

	return find(sourceFile);
}

/**
 * Finds a declaration by name in the TypeScript AST.
 */
function findDeclarationByName(sourceFile: ts.SourceFile, name: string): ts.Node | undefined {
	let found: ts.Node | undefined;

	function visit(node: ts.Node): void {
		if (found)
			return;

		// Check for class declarations
		if (ts.isClassDeclaration(node) && node.name?.text === name) {
			found = node;

			return;
		}

		// Check for variable declarations
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
			found = node;

			return;
		}

		// Check for function declarations
		if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
			found = node;

			return;
		}

		ts.forEachChild(node, visit);
	}

	visit(sourceFile);

	return found;
}


/**
 * Alternative approach: Check if a node is a class declaration by examining the Babel AST.
 * This is a fallback when TypeScript type checking is not available.
 */
export const isClassDeclarationInBabelAST = (
	path: NodePath<t.JSXElement>,
): boolean | undefined => {
	const openingElement = path.node.openingElement;
	if (!t.isJSXIdentifier(openingElement.name))
		return undefined;


	const tagName = openingElement.name.name;
	const binding = path.scope.getBinding(tagName);

	if (!binding)
		return undefined;


	const bindingPath = binding.path;

	// Check if it's a class declaration
	if (bindingPath.isClassDeclaration())
		return true;


	// Check if it's a variable declarator with a class expression
	if (bindingPath.isVariableDeclarator()) {
		const init = bindingPath.node.init;
		if (t.isClassExpression(init))
			return true;


		// Check if it's a string literal
		if (t.isStringLiteral(init))
			return true;
	}

	// Check if it's an import that we can't statically analyze
	if (bindingPath.isImportSpecifier() || bindingPath.isImportDefaultSpecifier())
		return undefined; // Can't determine from import alone


	return false;
};
