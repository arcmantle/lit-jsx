import { dirname } from 'node:path';

import type { Binding, NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { sync } from 'oxc-resolver';

import { Ensure, getPathFilename, isComponent } from './compiler-utils.ts';


export class ImportDiscovery {

	static readonly programCache:  Map<string, NodePath<t.Program>> = new Map();
	static readonly resolvedCache: Map<string, Map<string, boolean>> = new Map();
	static readonly validCalls:    Set<string> = new Set([ 'toComponent', 'toTag' ]);

	static clearCacheForFile(filePath: string): void {
		ImportDiscovery.programCache.delete(filePath);
		ImportDiscovery.resolvedCache.delete(filePath);
	}

	/**
	 * Finds the definition of a JSX element in the given path.
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

		const isValid = this.hasValidCallAssignment(programPath, binding);

		cached.set(elementName, isValid);

		return isValid;
	}

	protected hasValidCallAssignment(programPath: NodePath<t.Program>, binding: Binding): boolean {
		const node = binding.path.node;

		if (t.isVariableDeclarator(node)) {
			if (t.isCallExpression(node.init)) {
				const callee = node.init.callee;

				if (t.isIdentifier(callee)) {
					const calleeName = callee.name;

					// If the original callee name is a valid call
					// we don't have to check where it came from.
					if (ImportDiscovery.validCalls.has(calleeName))
						return true;

					// We can check where the callee came from.
					const newBinding = programPath.scope.getBinding(calleeName);
					if (!newBinding)
						return false;

					return this.hasValidCallAssignment(programPath, newBinding);
				}
			}
			else if (t.isIdentifier(node.init)) {
				const referencedName = node.init.name;
				const newBinding = programPath.scope.getBinding(referencedName);
				if (!newBinding)
					return false;

				return this.hasValidCallAssignment(programPath, newBinding);
			}
		}
		else if (t.isImportSpecifier(node)) {
			const imported = node.imported;
			const importedName = t.isIdentifier(imported)
				? imported.name
				: imported.value;

			if (ImportDiscovery.validCalls.has(importedName))
				return true;

			// Since the imported name is not a valid call,
			// we need to resolve the import, and rerun the followCallBinding
			// using the new programPath.
			const importDeclaration = binding.path.parent;
			if (t.isImportDeclaration(importDeclaration)) {
				const resolvedPath = this.resolveSourcePath(programPath, importDeclaration.source.value);
				if (!resolvedPath)
					return false;

				// We can now follow the new path
				const newProgramPath = this.getProgramPathFromFile(resolvedPath);
				if (!newProgramPath)
					return false;

				const newBinding = newProgramPath.scope.getBinding(importedName);
				if (!newBinding) {
					// If there is no binding for this import, it might be because it comes from an export.
					const exportChainResult = this.followExportChain(newProgramPath, importedName);
					if (!exportChainResult)
						return false;

					return this.hasValidCallAssignment(
						exportChainResult.programPath,
						exportChainResult.binding,
					);
				}

				return this.hasValidCallAssignment(newProgramPath, newBinding);
			}
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
