import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import ts from 'typescript';

import { ensureImportLoaded, getCachedTypeCheck, getSourceFile, getTypeChecker, hasCachedTypeCheck, setCachedTypeCheck } from './ts-program-manager.js';


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
	// Normalize path once at the start
	const normalizedFilename = filename.replace(/\\/g, '/');

	// Get the tag name from the JSX element
	const openingElement = path.node.openingElement;
	if (!t.isJSXIdentifier(openingElement.name))
		return undefined;

	const tagName = openingElement.name.name;

	// Check cache first (10-100x faster for repeated checks)
	// Use has-check to properly handle cached undefined values
	if (hasCachedTypeCheck(normalizedFilename, tagName))
		return getCachedTypeCheck(normalizedFilename, tagName);

	const typeChecker = getTypeChecker();
	const sourceFile = getSourceFile(normalizedFilename);

	if (!typeChecker || !sourceFile) {
		// Cache the undefined result to avoid repeated failed lookups
		setCachedTypeCheck(normalizedFilename, tagName, undefined);

		return undefined;
	}

	// Lazy-load: Ensure any imported file defining this symbol is loaded
	// Uses Language Service's own import analysis (not regex)
	// Pass normalized filename to avoid re-normalization
	ensureImportLoaded(tagName, normalizedFilename);

	// Find the symbol at the JSX usage location (works for both local declarations and imports)
	const identifier = findIdentifierInJSX(sourceFile, tagName);
	if (!identifier) {
		// Symbol not found in this file
		setCachedTypeCheck(normalizedFilename, tagName, undefined);

		return undefined;
	}

	const symbol = typeChecker.getSymbolAtLocation(identifier);
	if (!symbol) {
		// TypeScript can't resolve the symbol (likely invalid import or missing type info)
		setCachedTypeCheck(normalizedFilename, tagName, undefined);

		return undefined;
	}

	// Get the type of the symbol (this follows imports automatically)
	const type = typeChecker.getTypeOfSymbolAtLocation(symbol, identifier);
	const result = checkTypeForStaticOrDynamic(tagName, type, typeChecker);

	// Cache the result
	setCachedTypeCheck(normalizedFilename, tagName, result);

	return result;
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

	// Check if it's a union type of string literals (e.g., "a" | "div" | "button")
	if (type.flags & ts.TypeFlags.Union) {
		const unionType = type as ts.UnionType;
		// If ALL union members are string literals, treat as static
		const allStringLiterals = unionType.types.every(t => t.flags & ts.TypeFlags.StringLiteral);
		if (allStringLiterals)
			return true;
	}

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
	function visit(node: ts.Node): ts.Identifier | undefined {
		// Look for JSX elements with the matching tag name
		if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
			const tagNameNode = node.tagName;
			if (ts.isIdentifier(tagNameNode) && tagNameNode.text === name)
				return tagNameNode;
		}

		// Continue searching children
		return ts.forEachChild(node, visit);
	}

	return visit(sourceFile);
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
