import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import ts from 'typescript';

import {
	ensureFileLoaded, ensureImportLoaded, getCachedTypeCheck,
	getSourceFile, getTypeChecker, hasCachedTypeCheck, setCachedTypeCheck,
} from './ts-program-manager.js';


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
	code: string,
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

	// Lazy initialization: Only load file and initialize TypeScript when actually needed
	ensureFileLoaded(normalizedFilename, code);

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

	// CRITICAL: After loading imports, get a fresh type checker
	// This ensures TypeScript has the latest program state after loading re-export chain
	const freshTypeChecker = getTypeChecker();
	if (!freshTypeChecker) {
		setCachedTypeCheck(normalizedFilename, tagName, undefined);

		return undefined;
	}

	// Follow re-exports/aliases to get the actual symbol
	// Use fresh type checker to ensure it has latest program state
	const freshSymbol = freshTypeChecker.getSymbolAtLocation(identifier);
	const actualSymbol = freshSymbol && (freshSymbol.flags & ts.SymbolFlags.Alias)
		? freshTypeChecker.getAliasedSymbol(freshSymbol)
		: freshSymbol || symbol;

	// If we have a value declaration, get the type from it
	const typeNode = actualSymbol.valueDeclaration || identifier;
	const type = freshTypeChecker.getTypeAtLocation(typeNode);

	const result = checkTypeForStaticOrDynamic(tagName, type, freshTypeChecker);

	// Cache the result
	setCachedTypeCheck(normalizedFilename, tagName, result);

	return result;
};

/**
 * Checks if a JSX element refers to a class (not a string literal) based on TypeScript type information.
 *
 * Returns:
 * - `true` if the element is a class constructor (should use .tagName accessor)
 * - `false` if the element is a string literal or function component
 * - `undefined` if type checking is not available or the type cannot be determined
 */
export const isClassByType = (
	path: NodePath<t.JSXElement>,
	filename: string,
	code: string,
): boolean | undefined => {
	// Normalize path once at the start
	const normalizedFilename = filename.replace(/\\/g, '/');

	// Get the tag name from the JSX element
	const openingElement = path.node.openingElement;
	if (!t.isJSXIdentifier(openingElement.name))
		return undefined;

	const tagName = openingElement.name.name;

	// Lazy initialization: Only load file and initialize TypeScript when actually needed
	ensureFileLoaded(normalizedFilename, code);

	const typeChecker = getTypeChecker();
	const sourceFile = getSourceFile(normalizedFilename);

	if (!typeChecker || !sourceFile)
		return undefined;

	// Lazy-load: Ensure any imported file defining this symbol is loaded
	ensureImportLoaded(tagName, normalizedFilename);

	// Find the symbol at the JSX usage location
	const identifier = findIdentifierInJSX(sourceFile, tagName);
	if (!identifier)
		return undefined;

	const symbol = typeChecker.getSymbolAtLocation(identifier);
	if (!symbol)
		return undefined;

	// Get the type of the symbol
	const type = typeChecker.getTypeOfSymbolAtLocation(symbol, identifier);
	const result = checkTypeForClass(type, typeChecker);

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
 * Helper function to check if a type represents a class (not a string literal)
 */
function checkTypeForClass(
	type: ts.Type,
	typeChecker: ts.TypeChecker,
): boolean | undefined {
	// String literals should return false (they're not classes)
	if (type.flags & ts.TypeFlags.StringLiteral)
		return false;

	// Union types of string literals should return false
	if (type.flags & ts.TypeFlags.Union) {
		const unionType = type as ts.UnionType;
		const allStringLiterals = unionType.types.every(t => t.flags & ts.TypeFlags.StringLiteral);
		if (allStringLiterals)
			return false;
	}

	// Check if it's a class type
	if (type.symbol?.flags & ts.SymbolFlags.Class)
		return true;

	// Check if it has construct signatures (it's a constructor/class reference)
	const constructSignatures = typeChecker.getSignaturesOfType(type, ts.SignatureKind.Construct);
	if (constructSignatures.length > 0)
		return true;

	// Not a class
	return false;
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
