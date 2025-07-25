import { readFileSync } from 'node:fs';

import { parseSync } from '@babel/core';
import type { Binding, Hub, NodePath } from '@babel/traverse';
import * as t from '@babel/types';

import { isMathmlTag } from '../shared/mathml-tags.js';
import { isSvgTag } from '../shared/svg-tags.js';
import type { ProcessorContext } from './attribute-processor.js';
import { traverse } from './babel-traverse.js';
import { babelPlugins, ERROR_MESSAGES, SOURCES, VARIABLES } from './config.js';
import { isDynamicOrCustomElement } from './import-discovery.js';


export type Values<T> = T[keyof T];


export const isComponent = (tagName: string): boolean => {
	return (tagName[0] && tagName[0].toLowerCase() !== tagName[0])
		|| tagName.includes('.')
		|| /[^a-zA-Z]/.test(tagName[0] ?? '');
};

export const getProgramFromPath = (path: NodePath): t.Program => {
	const program = path.findParent(p => t.isProgram(p.node))?.node as t.Program | undefined;
	if (!program)
		throw new Error(ERROR_MESSAGES.NO_PROGRAM_FOUND);

	return program;
};


export const getPathFilename = (path: NodePath): string => {
	const hub = path.hub as Hub & { file?: { opts?: { filename?: string; }; }; } | undefined;
	const currentFileName = hub?.file?.opts?.filename?.replaceAll('\\', '/');

	return currentFileName ?? '';
};


/**
 * Contains utility methods for retrieving and manipulating node paths in Babel ASTs.
 */
export class Ensure {

	static findProgramPathFromNodePath(path: NodePath): NodePath<t.Program> {
		const programPath = path.findParent(p => t.isProgram(p.node)) as NodePath<t.Program>;
		if (!programPath)
			throw new Error('Could not find program path');

		return programPath;
	}

	static getProgramPathFromFile(filePath: string): NodePath<t.Program> | undefined {
		const fileContent = readFileSync(filePath, 'utf-8');

		let ast: t.File;
		try {
			ast = parseSync(fileContent, {
				filename:   filePath,
				parserOpts: {
					plugins: Array.from(babelPlugins),
				},
			})!;
		}
		catch (error) {
			return;
		}

		let programPath: NodePath<t.Program> = undefined as any;
		traverse(ast, { Program(path) { programPath = path; path.stop(); } });

		// Attach a minimal hub manually
		// this allows retrieving the filename from the path
		programPath.hub = {
			file: {
				opts: {
					filename: filePath,
				},
			},
		} as any;

		return programPath;
	}

	static import(
		importSource: (value: string) => boolean,
		importName: (value: string) => boolean,
		createImport: () => t.ImportDeclaration,
		program: t.Program,
		path: NodePath,
	): void {
		// Check if the import already exists
		const hasImport = program.body.some(node => {
			if (!t.isImportDeclaration(node))
				return false;

			// Check if the import source matches
			const isCorrectImport = importSource(node.source.value);
			if (!isCorrectImport)
				return false;

			// Check if the import name matches
			return node.specifiers.some(spec => {
				return t.isImportSpecifier(spec)
					? t.isIdentifier(spec.imported)
						? importName(spec.imported.name)
						: importName(spec.imported.value)
					: false;
			});
		});

		// If import name not found, check if we can append to existing import source
		if (!hasImport) {
			// Find existing import declaration with matching source that is not type-only
			const existingImport = program.body.find(node => {
				return t.isImportDeclaration(node)
					&& importSource(node.source.value)
					&& node.importKind !== 'type';
			}) as t.ImportDeclaration | undefined;

			if (existingImport) {
				// Append to existing import
				const newImportDeclaration = createImport();
				const newSpecifiers = newImportDeclaration.specifiers.filter(spec =>
					t.isImportSpecifier(spec));

				// Add new specifiers to existing import
				existingImport.specifiers.push(...newSpecifiers);
			}
			else {
				// Create new import declaration
				const importDeclaration = createImport();
				const programPath = path.findParent(p => t.isProgram(p.node)) as NodePath<t.Program>;

				// Insert at the top of the file
				const [ insertedPath ] = programPath.unshiftContainer('body', importDeclaration);
				programPath.scope.registerDeclaration(insertedPath);
			}
		}
	}

	static getNodePath<T extends t.Node>(
		node: T,
		path: NodePath,
	): NodePath<T> | undefined {
		// First, traverse upwards to find the root (Program) path
		let rootPath = path;
		while (rootPath.parentPath)
			rootPath = rootPath.parentPath;

		// Now traverse down from the root to find the target node
		let foundPath: NodePath<T> | undefined;

		rootPath.traverse({
			enter(path) {
				if (path.node === node) {
					foundPath = path as NodePath<T>;
					path.stop();
				}
			},
		});

		return foundPath;
	}

	static getClosestStatementPath(path: NodePath): NodePath<t.Statement> {
		let statementPath: NodePath<t.Node> | null = path;

		while (statementPath && !statementPath.isStatement())
			statementPath = statementPath.parentPath;

		if (!statementPath)
			throw new Error(`Could not find statement path for node insertion`);

		return statementPath;
	}

	static getClosestBinding(path: NodePath, name: string): Binding | undefined {
		let currentScope = path.scope;
		while (currentScope) {
			const existingBinding = currentScope.getBinding(name);
			if (existingBinding)
				return existingBinding;

			currentScope = currentScope.parent;
		}
	}

	/**
 	* Finds the closest arrow function expression with an expression body
	* starting from the given path.
	* Returns the NodePath of the arrow function expression if found, otherwise undefined.
	*/
	static getArrowExpressionPath(
		path: NodePath,
	): NodePath<t.ArrowFunctionExpression> |  undefined {
		// Check if we're inside an arrow function with an expression body
		let currentPath: NodePath | null = path;
		let arrowFunctionPath: NodePath<t.ArrowFunctionExpression> | undefined;

		while (currentPath && currentPath.parentPath) {
			if (t.isArrowFunctionExpression(currentPath.node) && t.isExpression(currentPath.node.body)) {
				arrowFunctionPath = currentPath as NodePath<t.ArrowFunctionExpression>;
				break;
			}

			currentPath = currentPath.parentPath;
		}

		return arrowFunctionPath;
	}

	/**
	* Hoists the expression to a variable declaration in the closest scope.
	*
	* If the path is inside an arrow function with an expression body, it converts
	* the arrow function body to a block statement and inserts the variable declaration
	* before the return statement.
	*
	* If the path is not inside such an arrow function, it inserts the variable declaration
	* before the closest statement and replaces the target node with the new variable identifier.
	*/
	static replaceAndHoistAsVariable(
		path: NodePath,
		variableName: string,
		expression: t.Expression,
		expandArrow = true,
	): t.Identifier {
		if (this.getClosestBinding(path, variableName))
			return t.identifier(variableName);

		const nodeToReplace = path.node;

		// Create the new variable declaration
		const identifier = t.identifier(variableName);
		const declarator = t.variableDeclarator(identifier, expression);
		const variableDeclaration = t.variableDeclaration('const', [ declarator ]);

		// Check if we're inside an arrow function with an expression body
		// If expandArrow is false, we skip this check and always insert
		// the variable declaration as a regular statement.
		const arrowFunctionPath = expandArrow ? this.getArrowExpressionPath(path) : undefined;

		if (arrowFunctionPath) {
			// Convert arrow function expression body to block statement
			const returnStatement = t.returnStatement(identifier);
			const blockStatement = t.blockStatement([ variableDeclaration, returnStatement ]);

			// Replace the arrow function body
			arrowFunctionPath.get('body').replaceWith(blockStatement);

			// Replace the target node with an identifier pointing to the new variable
			const nodePath = this.getNodePath(nodeToReplace, path);
			nodePath?.replaceWith(identifier);
		}
		else {
			// Fall back to the original behavior
			const statementPath = this.getClosestStatementPath(path);

			// Insert the new declaration before the current statement
			const [ insertedPath ] = statementPath.insertBefore(variableDeclaration);

			// Register the new declaration with the appropriate scope
			statementPath.scope.registerDeclaration(insertedPath);

			// Replace the target node with an identifier pointing to the new variable
			const nodePath = this.getNodePath(nodeToReplace, path);
			nodePath?.replaceWith(identifier);
		}

		return identifier;
	}

	static hoistAsTopLevelVariable(
		path: NodePath,
		variableName: string,
		expression: t.Expression,
	): t.Identifier {
		// Find the program path
		const programPath = this.findProgramPathFromNodePath(path);

		// Check if variable with this name already exists at the top level
		const existingBinding = programPath.scope.getBinding(variableName);
		if (existingBinding)
			return t.identifier(variableName);

		// Create the variable declaration
		const identifier = t.identifier(variableName);
		const declarator = t.variableDeclarator(identifier, expression);
		const variableDeclaration = t.variableDeclaration('const', [ declarator ]);

		// Find the last import declaration index
		const programBody = programPath.node.body;
		const lastImportIndex = programBody.reduceRight((lastIndex, node, index) => {
			return lastIndex === -1 && t.isImportDeclaration(node) ? index : lastIndex;
		}, -1);

		// Insert after the last import, or at the beginning if no imports
		const insertionIndex = lastImportIndex + 1;

		if (insertionIndex === 0 || insertionIndex >= programBody.length) {
			// No imports found or at the end - add to the beginning/end
			const [ insertedPath ] = insertionIndex === 0
				? programPath.unshiftContainer('body', variableDeclaration)
				: programPath.pushContainer('body', variableDeclaration);

			programPath.scope.registerDeclaration(insertedPath);
		}
		else {
			// Insert after the last import
			const bodyPaths = programPath.get('body') as NodePath<t.Statement>[];
			const targetPath = bodyPaths[insertionIndex];
			if (targetPath) {
				const [ insertedPath ] = targetPath.insertBefore(variableDeclaration);
				programPath.scope.registerDeclaration(insertedPath);
			}
		}

		return identifier;
	}

	static componentTagDeclaration(
		path: NodePath,
		tagName: string,
		variableName: string,
		createDeclaration: () => t.VariableDeclarator,
	): t.Identifier {
		// Start from the current scope and work upward
		let currentScope = path.scope;

		while (currentScope) {
			// First check if the prefixed variable already exists
			const prefixedBinding = currentScope.getBinding(variableName);
			if (prefixedBinding)
				return t.identifier(variableName);

			// Then check if the tagName exists
			const tagNameBinding = currentScope.getBinding(tagName);
			if (tagNameBinding) {
				// Found the tagName binding, now insert the prefixed declaration
				const declarator = createDeclaration();
				const variableDeclaration = t.variableDeclaration('const', [ declarator ]);

				// Check if the binding is a function parameter
				if (tagNameBinding.kind === 'param') {
					// For function parameters, insert at the beginning of the function body
					const functionPath = tagNameBinding.path.getFunctionParent();

					if (t.isFunction(functionPath?.node)) {
						const body = functionPath.node.body;

						if (t.isBlockStatement(body)) {
							const bodyPath = this.getNodePath(body, path)!;

							// Insert at the beginning of the block statement using paths
							const [ insertedPath ] = bodyPath.unshiftContainer('body', variableDeclaration);

							// Register the new declaration with the body's scope
							bodyPath.scope.registerDeclaration(insertedPath);
						}
						else {
							throw new Error(ERROR_MESSAGES.BODY_NOT_BLOCK(tagName));
						}
					}
				}
				else {
					// For non-parameter bindings, insert after the declaration
					// Find the statement-level path to insert after
					let statementPath: NodePath<t.Node> | null = tagNameBinding.path;
					while (statementPath && !statementPath.isStatement())
						statementPath = statementPath.parentPath;

					if (!statementPath)
						throw new Error(ERROR_MESSAGES.NO_STATEMENT_PATH(tagName));

					// Insert the new declaration after the statement containing the tagName declaration
					const [ insertedPath ] = statementPath.insertAfter(variableDeclaration);

					// Register the new declaration with the appropriate scope
					statementPath.scope.registerDeclaration(insertedPath);
				}

				return t.identifier(variableName);
			}

			// Move up to the parent scope
			currentScope = currentScope.parent;
		}

		// If tagName is not found in any scope, throw an error
		throw new Error(ERROR_MESSAGES.TAG_NAME_NOT_FOUND(tagName));
	}

	static componentLiteral(
		tagName: string,
		variableName: string,
		path: NodePath,
		program: t.Program,
	): t.Identifier {
		EnsureImport.literalMap(program, path);

		return this.componentTagDeclaration(
			path,
			tagName,
			variableName,
			() => t.variableDeclarator(
				t.identifier(variableName),
				t.callExpression(
					t.memberExpression(
						t.identifier(VARIABLES.LITERAL_MAP),
						t.identifier('get'),
					),
					[ t.identifier(tagName) ],
				),
			),
		);
	}

}


export class EnsureImport {

	static html(program: t.Program, path: NodePath): void {
		Ensure.import(
			(source) => source === SOURCES.HTML || source === SOURCES.HTML_ALT,
			(name) => name === VARIABLES.HTML,
			() => t.importDeclaration(
				[
					t.importSpecifier(
						t.identifier(VARIABLES.HTML_LOCAL),
						t.identifier(VARIABLES.HTML),
					),
				],
				t.stringLiteral(SOURCES.HTML),
			),
			program,
			path,
		);
	}

	static htmlStatic(program: t.Program, path: NodePath): void {
		Ensure.import(
			(source) => source === SOURCES.HTML_STATIC || source === SOURCES.HTML_STATIC_ALT,
			(name) => name === VARIABLES.HTML,
			() => t.importDeclaration(
				[
					t.importSpecifier(
						t.identifier(VARIABLES.HTML_STATIC_LOCAL),
						t.identifier(VARIABLES.HTML_STATIC),
					),
				],
				t.stringLiteral(SOURCES.HTML_STATIC),
			),
			program,
			path,
		);
	}

	static svg(program: t.Program, path: NodePath): void {
		Ensure.import(
			(source) => source === SOURCES.SVG || source === SOURCES.SVG_ALT,
			(name) => name === VARIABLES.SVG,
			() => t.importDeclaration(
				[
					t.importSpecifier(
						t.identifier(VARIABLES.SVG_LOCAL),
						t.identifier(VARIABLES.SVG),
					),
				],
				t.stringLiteral(SOURCES.SVG),
			),
			program,
			path,
		);
	}

	static svgStatic(program: t.Program, path: NodePath): void {
		Ensure.import(
			(source) => source === SOURCES.SVG_STATIC || source === SOURCES.SVG_STATIC_ALT,
			(name) => name === VARIABLES.SVG,
			() => t.importDeclaration(
				[
					t.importSpecifier(
						t.identifier(VARIABLES.SVG_STATIC_LOCAL),
						t.identifier(VARIABLES.SVG_STATIC),
					),
				],
				t.stringLiteral(SOURCES.SVG_STATIC),
			),
			program,
			path,
		);
	}

	static mathml(program: t.Program, path: NodePath): void {
		Ensure.import(
			(source) => source === SOURCES.MATHML || source === SOURCES.MATHML_ALT,
			(name) => name === VARIABLES.MATHML,
			() => t.importDeclaration(
				[
					t.importSpecifier(
						t.identifier(VARIABLES.MATHML_LOCAL),
						t.identifier(VARIABLES.MATHML),
					),
				],
				t.stringLiteral(SOURCES.MATHML),
			),
			program,
			path,
		);
	}

	static mathmlStatic(program: t.Program, path: NodePath): void {
		Ensure.import(
			(source) => source === SOURCES.MATHML_STATIC || source === SOURCES.MATHML_STATIC_ALT,
			(name) => name === VARIABLES.MATHML,
			() => t.importDeclaration(
				[
					t.importSpecifier(
						t.identifier(VARIABLES.MATHML_STATIC_LOCAL),
						t.identifier(VARIABLES.MATHML_STATIC),
					),
				],
				t.stringLiteral(SOURCES.MATHML_STATIC),
			),
			program,
			path,
		);
	}

	static unsafeStatic(program: t.Program, path: NodePath): void {
		Ensure.import(
			(source) => source === SOURCES.UNSAFE_STATIC || source === SOURCES.UNSAFE_STATIC_ALT,
			(name) => name === VARIABLES.UNSAFE_STATIC,
			() => t.importDeclaration(
				[
					t.importSpecifier(
						t.identifier(VARIABLES.UNSAFE_STATIC_LOCAL),
						t.identifier(VARIABLES.UNSAFE_STATIC),
					),
				],
				t.stringLiteral(SOURCES.UNSAFE_STATIC),
			),
			program,
			path,
		);
	}

	static createRef(program: t.Program, path: NodePath): void {
		Ensure.import(
			(source) => source === SOURCES.REF_ALT || source === SOURCES.REF,
			(name) => name === VARIABLES.REF,
			() => t.importDeclaration(
				[
					t.importSpecifier(
						t.identifier(VARIABLES.REF_LOCAL),
						t.identifier(VARIABLES.REF),
					),
				],
				t.stringLiteral(SOURCES.REF),
			),
			program,
			path,
		);
	}

	static styleMap(program: t.Program, path: NodePath): void {
		Ensure.import(
			(source) => source === SOURCES.STYLE_MAP_ALT || source === SOURCES.STYLE_MAP,
			(name) => name === VARIABLES.STYLE_MAP,
			() => t.importDeclaration(
				[
					t.importSpecifier(
						t.identifier(VARIABLES.STYLE_MAP_LOCAL),
						t.identifier(VARIABLES.STYLE_MAP),
					),
				],
				t.stringLiteral(SOURCES.STYLE_MAP),
			),
			program,
			path,
		);
	}

	static classMap(program: t.Program, path: NodePath): void {
		Ensure.import(
			(source) => source === SOURCES.CLASS_MAP_ALT || source === SOURCES.CLASS_MAP,
			(name) => name === VARIABLES.CLASS_MAP,
			() => t.importDeclaration(
				[
					t.importSpecifier(
						t.identifier(VARIABLES.CLASS_MAP_LOCAL),
						t.identifier(VARIABLES.CLASS_MAP),
					),
				],
				t.stringLiteral(SOURCES.CLASS_MAP),
			),
			program,
			path,
		);
	}

	static rest(program: t.Program, path: NodePath): void {
		Ensure.import(
			(source) => source === SOURCES.REST,
			(name) => name === VARIABLES.REST,
			() => t.importDeclaration(
				[
					t.importSpecifier(
						t.identifier(VARIABLES.REST),
						t.identifier(VARIABLES.REST),
					),
				],
				t.stringLiteral(SOURCES.REST),
			),
			program,
			path,
		);
	}

	static literalMap(program: t.Program, path: NodePath): void {
		Ensure.import(
			(source) => source === SOURCES.LITERAL_MAP,
			(name) => name === VARIABLES.LITERAL_MAP,
			() => t.importDeclaration(
				[
					t.importSpecifier(
						t.identifier(VARIABLES.LITERAL_MAP),
						t.identifier(VARIABLES.LITERAL_MAP),
					),
				],
				t.stringLiteral(SOURCES.LITERAL_MAP),
			),
			program,
			path,
		);
	}

	static taggedTemplateUtil(program: t.Program, path: NodePath): void {
		Ensure.import(
			(source) => source === SOURCES.JSX_LIT,
			(name) => name === VARIABLES.TAGGED_TEMPLATE_UTIL,
			() => t.importDeclaration([
				t.importSpecifier(
					t.identifier(VARIABLES.TAGGED_TEMPLATE_UTIL),
					t.identifier(VARIABLES.TAGGED_TEMPLATE_UTIL),
				),
			], t.stringLiteral(SOURCES.JSX_LIT)),
			program,
			path,
		);
	}

	static booleanPart(program: t.Program, path: NodePath): void {
		Ensure.import(
			(source) => source === SOURCES.JSX_LIT,
			(name) => name === VARIABLES.BOOLEAN_PART,
			() => t.importDeclaration([
				t.importSpecifier(
					t.identifier(VARIABLES.BOOLEAN_PART),
					t.identifier(VARIABLES.BOOLEAN_PART),
				),
			], t.stringLiteral(SOURCES.JSX_LIT)),
			program,
			path,
		);
	}

	static attributePart(program: t.Program, path: NodePath): void {
		Ensure.import(
			(source) => source === SOURCES.JSX_LIT,
			(name) => name === VARIABLES.ATTRIBUTE_PART,
			() => t.importDeclaration([
				t.importSpecifier(
					t.identifier(VARIABLES.ATTRIBUTE_PART),
					t.identifier(VARIABLES.ATTRIBUTE_PART),
				),
			], t.stringLiteral(SOURCES.JSX_LIT)),
			program,
			path,
		);
	}

	static propertyPart(program: t.Program, path: NodePath): void {
		Ensure.import(
			(source) => source === SOURCES.JSX_LIT,
			(name) => name === VARIABLES.PROPERTY_PART,
			() => t.importDeclaration([
				t.importSpecifier(
					t.identifier(VARIABLES.PROPERTY_PART),
					t.identifier(VARIABLES.PROPERTY_PART),
				),
			], t.stringLiteral(SOURCES.JSX_LIT)),
			program,
			path,
		);
	}

	static elementPart(program: t.Program, path: NodePath): void {
		Ensure.import(
			(source) => source === SOURCES.JSX_LIT,
			(name) => name === VARIABLES.ELEMENT_PART,
			() => t.importDeclaration([
				t.importSpecifier(
					t.identifier(VARIABLES.ELEMENT_PART),
					t.identifier(VARIABLES.ELEMENT_PART),
				),
			], t.stringLiteral(SOURCES.JSX_LIT)),
			program,
			path,
		);
	}

	static eventPart(program: t.Program, path: NodePath): void {
		Ensure.import(
			(source) => source === SOURCES.JSX_LIT,
			(name) => name === VARIABLES.EVENT_PART,
			() => t.importDeclaration([
				t.importSpecifier(
					t.identifier(VARIABLES.EVENT_PART),
					t.identifier(VARIABLES.EVENT_PART),
				),
			], t.stringLiteral(SOURCES.JSX_LIT)),
			program,
			path,
		);
	}

	static childPart(program: t.Program, path: NodePath): void {
		Ensure.import(
			(source) => source === SOURCES.JSX_LIT,
			(name) => name === VARIABLES.CHILD_PART,
			() => t.importDeclaration([
				t.importSpecifier(
					t.identifier(VARIABLES.CHILD_PART),
					t.identifier(VARIABLES.CHILD_PART),
				),
			], t.stringLiteral(SOURCES.JSX_LIT)),
			program,
			path,
		);
	}

}


export type ValidJSXElement = t.JSXElement & {
	openingElement: t.JSXOpeningElement & {
		name: t.JSXIdentifier | t.JSXMemberExpression;
	};
};

export const isValidJSXElement = (path: NodePath): path is NodePath<ValidJSXElement> => {
	const node = path.node;

	return t.isJSXElement(node)
		&& t.isJSXOpeningElement(node.openingElement)
		&& (t.isJSXIdentifier(node.openingElement.name)
		|| t.isJSXMemberExpression(node.openingElement.name));
};


export const isValidOpeningElement = (path: NodePath): path is NodePath<t.JSXElement | t.JSXFragment> => {
	return t.isJSXElement(path.node) || t.isJSXFragment(path.node);
};


export const getJSXElementName = (node: t.JSXElement): string => {
	const openingElement = node.openingElement;

	const name = t.isJSXIdentifier(openingElement.name)
		? openingElement.name.name
		: t.isJSXMemberExpression(openingElement.name)
			? t.isJSXIdentifier(openingElement.name.object)
				? openingElement.name.object.name + '.' + openingElement.name.property.name
				: ''
			: '';

	return name;
};


export const isJSXCustomElementComponent = (
	path: NodePath<t.JSXElement | t.JSXFragment>,
): boolean => {
	const node = path.node;

	if (t.isJSXFragment(node))
		return false;

	const tagName: string = getJSXElementName(node);

	if (!isComponent(tagName))
		return false;

	if (isDynamicOrCustomElement(path.get('openingElement')))
		return true;

	return false;
};


export const isJSXFunctionElementComponent = (
	path: NodePath<t.JSXElement | t.JSXFragment>,
): boolean => {
	const node = path.node;

	if (t.isJSXFragment(node))
		return false;

	const tagName: string = getJSXElementName(node);

	if (!isComponent(tagName))
		return false;

	if (isDynamicOrCustomElement(path.get('openingElement')))
		return false;

	return true;
};


export const isJSXElementPath = (path: NodePath): path is NodePath<t.JSXElement> => t.isJSXElement(path.node);
export const isJSXFragmentPath = (path: NodePath): path is NodePath<t.JSXFragment> => t.isJSXFragment(path.node);


/**
 * Determines if a JSX element will result in a static template.
 * This function traverses the JSX tree to check if any custom element components
 * are present, which would make the template static.
 *
 * @param path - The NodePath of the JSX element to analyze
 * @returns true if the template will be static, false otherwise
 */
export const isJSXElementStatic = (path: NodePath<t.JSXElement | t.JSXFragment>): boolean => {
	if (isJSXCustomElementComponent(path))
		return true;

	for (const childPath of path.get('children')) {
		if (!isJSXElementPath(childPath) && !isJSXFragmentPath(childPath))
			continue;

		if (isJSXElementStatic(childPath))
			return true;
	}

	return false;
};


export const ensureImports = (context: ProcessorContext): void => {
	type Imports = Omit<typeof EnsureImport, 'prototype'>;
	const record = EnsureImport as Imports;

	// Ensure all imports used in the JSX element are imported.
	context.importsUsed.forEach(importName => {
		const key = importName as keyof Imports;
		if (key in record)
			record[key](context.program, context.path);
	});
};

export type TemplateType = Values<Pick<typeof VARIABLES, 'HTML' | 'SVG' | 'MATHML'>>;
export const getTemplateType = (path: NodePath<t.JSXElement | t.JSXFragment>): TemplateType => {
	if (t.isJSXElement(path.node)) {
		const name = getJSXElementName(path.node);

		return getTemplateTag(name);
	}

	for (const childPath of path.get('children')) {
		if (!isJSXElementPath(childPath) && !isJSXFragmentPath(childPath))
			continue;

		return getTemplateType(childPath);
	}

	return VARIABLES.HTML;
};


export const getTemplateTag = (
	tagName: string,
): Values<Pick<typeof VARIABLES, 'HTML' | 'SVG' | 'MATHML'>> => {
	if (isSvgTag(tagName))
		return VARIABLES.SVG;

	if (isMathmlTag(tagName))
		return VARIABLES.MATHML;

	return VARIABLES.HTML;
};
