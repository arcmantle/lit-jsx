import { dirname } from 'node:path';

import type { Binding, NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { sync } from 'oxc-resolver';

import { Ensure, getPathFilename, isComponent } from './compiler-utils.ts';


export class ImportDiscovery {

	static readonly programCache:  Map<string, NodePath<t.Program>> = new Map();
	static readonly resolvedCache: Map<string, Map<string, boolean>> = new Map();

	static clearCacheForFile(filePath: string): void {
		ImportDiscovery.programCache.delete(filePath);
		ImportDiscovery.resolvedCache.delete(filePath);
	}

	/**
	 * Checks if a JSX element is a class (custom element) or string literal (static element).
	 * Returns true if it's a custom element (class) or static element (string literal).
	 */
	isDynamicOrCustomELement(path: NodePath): boolean {
		if (!t.isJSXOpeningElement(path.node))
			return false;

		if (!t.isJSXIdentifier(path.node.name))
			return false;

		const elementName = path.node.name.name;
		const filePath = getPathFilename(path);

		const cached = ImportDiscovery.resolvedCache.get(filePath)
			?? ImportDiscovery.resolvedCache
				.set(filePath, new Map())
				.get(filePath)!;

		const cachedValue = cached.get(elementName);
		if (cachedValue !== undefined)
			return cached.get(elementName)!;

		if (!isComponent(elementName))
			return false;

		const programPath = Ensure.findProgramPathFromNodePath(path);

		const binding = path.scope.getBinding(elementName);
		if (!binding)
			return false;

		const isValid = this.isClassOrStringLiteral(programPath, binding);

		cached.set(elementName, isValid);

		return isValid;
	}

	/**
	 * Checks if a JSX element is specifically a class (not a string literal).
	 * Returns true only for class declarations/expressions, false otherwise.
	 * Used to determine if .tagName accessor should be used.
	 */
	isClassByImportDiscovery(path: NodePath): boolean {
		if (!t.isJSXOpeningElement(path.node))
			return false;

		if (!t.isJSXIdentifier(path.node.name))
			return false;

		const elementName = path.node.name.name;

		if (!isComponent(elementName))
			return false;

		const programPath = Ensure.findProgramPathFromNodePath(path);

		const binding = path.scope.getBinding(elementName);
		if (!binding)
			return false;

		return this.isClass(programPath, binding);
	}

	/**
	 * Recursively follows a binding to determine if it resolves to a class (not a string literal).
	 */
	protected isClass(programPath: NodePath<t.Program>, binding: Binding): boolean {
		const node = binding.path.node;

		// Check for class declarations: class MyElement extends HTMLElement {}
		if (t.isClassDeclaration(node))
			return true;

		if (t.isVariableDeclarator(node)) {
			const init = node.init;
			if (!init)
				return false;

			// Check for class expressions: const MyElement = class {}
			if (t.isClassExpression(init))
				return true;

			// String literals are NOT classes
			if (t.isStringLiteral(init))
				return false;

			if (t.isTemplateLiteral(init))
				return false;

			// Follow identifiers: const MyElement = SomeOtherElement
			if (t.isIdentifier(init)) {
				const referencedName = init.name;
				const newBinding = programPath.scope.getBinding(referencedName);
				if (!newBinding)
					return false;

				return this.isClass(programPath, newBinding);
			}

			// Skip call expressions
			if (t.isCallExpression(init))
				return false;
		}
		else if (t.isImportSpecifier(node) || t.isImportDefaultSpecifier(node)) {
			const importDeclaration = binding.path.parent;
			if (!t.isImportDeclaration(importDeclaration))
				return false;

			const resolvedPath = this.resolveSourcePath(programPath, importDeclaration.source.value);
			if (!resolvedPath)
				return false;

			const newProgramPath = this.getProgramPathFromFile(resolvedPath);
			if (!newProgramPath)
				return false;

			const importedName = t.isImportDefaultSpecifier(node)
				? 'default'
				: t.isIdentifier(node.imported)
					? node.imported.name
					: node.imported.value;

			const newBinding = newProgramPath.scope.getBinding(importedName);
			if (newBinding)
				return this.isClass(newProgramPath, newBinding);

			const exportChainResult = this.followExportChain(newProgramPath, importedName);
			if (!exportChainResult)
				return false;

			return this.isClass(
				exportChainResult.programPath,
				exportChainResult.binding,
			);
		}

		return false;
	}

	/**
	 * Recursively follows a binding to determine if it resolves to a class or string literal.
	 */
	protected isClassOrStringLiteral(programPath: NodePath<t.Program>, binding: Binding): boolean {
		const node = binding.path.node;

		// Check for class declarations: class MyElement extends HTMLElement {}
		if (t.isClassDeclaration(node))
			return true;

		if (t.isVariableDeclarator(node)) {
			const init = node.init;
			if (!init)
				return false;

			// Check for class expressions: const MyElement = class {}
			if (t.isClassExpression(init))
				return true;

			// Check for string literals: const MyElement = 'my-element'
			if (t.isStringLiteral(init))
				return true;

			// Check for template literals that are static: const MyElement = `my-element`
			if (t.isTemplateLiteral(init) && init.expressions.length === 0 && init.quasis.length === 1)
				return true;

			// Follow identifiers: const MyElement = SomeOtherElement
			if (t.isIdentifier(init)) {
				const referencedName = init.name;
				const newBinding = programPath.scope.getBinding(referencedName);
				if (!newBinding)
					return false;

				return this.isClassOrStringLiteral(programPath, newBinding);
			}

			// Follow call expressions that might return a class or string
			if (t.isCallExpression(init)) {
				// We can't determine the return type of arbitrary functions without type checking
				// So we skip call expressions for now
				return false;
			}
		}
		else if (t.isImportSpecifier(node) || t.isImportDefaultSpecifier(node)) {
			const importDeclaration = binding.path.parent;
			if (!t.isImportDeclaration(importDeclaration))
				return false;

			const resolvedPath = this.resolveSourcePath(programPath, importDeclaration.source.value);
			if (!resolvedPath)
				return false;

			const newProgramPath = this.getProgramPathFromFile(resolvedPath);
			if (!newProgramPath)
				return false;

			// Get the imported name
			const importedName = t.isImportDefaultSpecifier(node)
				? 'default'
				: t.isIdentifier(node.imported)
					? node.imported.name
					: node.imported.value;

			// Try to find binding in the imported file
			const newBinding = newProgramPath.scope.getBinding(importedName);
			if (newBinding)
				return this.isClassOrStringLiteral(newProgramPath, newBinding);

			// If no binding, check export chain
			const exportChainResult = this.followExportChain(newProgramPath, importedName);
			if (!exportChainResult)
				return false;

			return this.isClassOrStringLiteral(
				exportChainResult.programPath,
				exportChainResult.binding,
			);
		}
		else if (t.isIdentifier(node)) {
			// Handle function parameters: function render(Element: typeof MyElement)
			// We can't determine the actual type without type checking, skip for now
			return false;
		}

		return false;
	}

	protected followExportChain(programPath: NodePath<t.Program>, importedName: string): {
		programPath: NodePath<t.Program>;
		binding:     Binding;
	} | undefined {
		const allNamedExports = programPath.node.body.filter(
			statement => t.isExportNamedDeclaration(statement),
		);

		let exportStatement: t.ExportNamedDeclaration | undefined;
		let exportSpecifier: t.ExportSpecifier | undefined;
		for (const statement of allNamedExports) {
			for (const specifier of statement.specifiers) {
				if (!t.isExportSpecifier(specifier))
					continue;

				const exportedName = t.isIdentifier(specifier.exported)
					? specifier.exported.name
					: specifier.exported.value;

				if (exportedName === importedName) {
					exportStatement = statement;
					exportSpecifier = specifier;

					break;
				}
			}
		}

		if (exportStatement && exportSpecifier) {
			// We found an export specifier that matches the imported name.
			// We will use the local name as it might have been renamed for the export.
			const localName = exportSpecifier.local.name;

			if (!exportStatement.source) {
				// This is a local export, we can just return the binding
				const binding = programPath.scope.getBinding(localName);
				if (!binding)
					return;

				// We can now follow the binding
				return { programPath, binding };
			}

			const resolvedPath = this.resolveSourcePath(programPath, exportStatement.source.value);
			if (!resolvedPath)
				return;

			const newProgramPath = this.getProgramPathFromFile(resolvedPath);
			if (!newProgramPath)
				return;

			const binding = newProgramPath.scope.getBinding(localName);
			if (!binding)
				return this.followExportChain(newProgramPath, localName);

			return { programPath: newProgramPath, binding };
		}

		// If we didn't find a direct export, we need to check for export all statements
		const allExportAlls = programPath.node.body.filter(
			statement => t.isExportAllDeclaration(statement),
		);

		// We loop through each export all statement
		// and check if our import is defined in any of them.
		for (const statement of allExportAlls) {
			const resolvedPath = this.resolveSourcePath(programPath, statement.source.value);
			if (!resolvedPath)
				continue;

			const newProgramPath = this.getProgramPathFromFile(resolvedPath);
			if (!newProgramPath)
				continue;

			// We can now follow the export chain in the new program path
			const binding = newProgramPath.scope.getBinding(importedName);
			if (binding)
				return { programPath: newProgramPath, binding };

			const exportChainResult = this.followExportChain(newProgramPath, importedName);
			if (exportChainResult)
				return exportChainResult;
		}

		return;
	}

	protected getProgramPathFromFile(filePath: string): NodePath<t.Program> | undefined {
		let programPath = ImportDiscovery.programCache.get(filePath);
		if (programPath)
			return programPath;

		programPath = Ensure.getProgramPathFromFile(filePath);
		if (!programPath)
			return undefined;

		ImportDiscovery.programCache.set(filePath, programPath);

		return programPath;
	}

	protected resolveSourcePath(programPath: NodePath<t.Program>, source: string): string {
		const importSource   = source;
		const filePath       = getPathFilename(programPath);
		const currentDir     = dirname(filePath);
		const resolvedResult = sync(currentDir, importSource);
		const resolvedPath   = resolvedResult.path?.replaceAll('\\', '/');

		return resolvedPath ?? '';
	}

}


let discovery: ImportDiscovery;
export const isDynamicOrCustomElement = (
	...args: Parameters<ImportDiscovery['isDynamicOrCustomELement']>
): ReturnType<ImportDiscovery['isDynamicOrCustomELement']> => {
	discovery ??= new ImportDiscovery();

	return discovery.isDynamicOrCustomELement(...args);
};

export const isClassByImportDiscovery = (
	...args: Parameters<ImportDiscovery['isClassByImportDiscovery']>
): ReturnType<ImportDiscovery['isClassByImportDiscovery']> => {
	discovery ??= new ImportDiscovery();

	return discovery.isClassByImportDiscovery(...args);
};
