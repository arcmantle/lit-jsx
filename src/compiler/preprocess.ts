import type { PluginPass } from '@babel/core';
import type { NodePath, TraverseOptions, VisitNodeFunction } from '@babel/traverse';
import * as t from '@babel/types';
import { isValidHTMLNesting } from 'validate-html-nesting';

import { isComponent } from './compiler-utils.js';


const ensureValidJSXNesting: TraverseOptions = {
	// From https://github.com/MananTank/babel-plugin-validate-jsx-nesting/blob/main/src/index.js
	// Validates JSX nesting based on HTML5 rules.
	JSXElement(path) {
		const elName = path.node.openingElement.name;
		const parent = path.parent;

		if (!t.isJSXElement(parent) || !t.isJSXIdentifier(elName))
			return;

		const elTagName = elName.name;
		if (isComponent(elTagName))
			return;

		const parentElName = parent.openingElement.name;
		if (!t.isJSXIdentifier(parentElName))
			return;

		const parentElTagName = parentElName.name;
		if (!isComponent(parentElTagName)) {
			if (!isValidHTMLNesting(parentElTagName, elTagName)) {
				throw path.buildCodeFrameError(
				`Invalid JSX: <${ elTagName }> cannot be child of <${ parentElTagName }>`,
				);
			}
		}
	},
};


const ensureValidFunctionsReturningJSX: TraverseOptions = {
	JSXElement(path) {
		// Check if this JSX element is directly inside an arrow function with expression body
		let currentPath: NodePath | null = path.parentPath;

		// Traverse up the AST to find if we're inside an arrow function expression body
		while (currentPath) {
			if (t.isArrowFunctionExpression(currentPath.node)) {
				const arrowFunction = currentPath.node;

				// Check if the arrow function has an expression body (not a block statement)
				if (t.isExpression(arrowFunction.body)) {
					// Convert the expression body to a block statement with a return statement
					const returnStatement = t.returnStatement(arrowFunction.body);
					const blockStatement = t.blockStatement([ returnStatement ]);

					// Replace the arrow function body with the block statement
					const bodyPath = currentPath.get('body');
					if (Array.isArray(bodyPath)) {
						// This shouldn't happen for arrow function body, but handle it safely
						throw new Error('Unexpected array path for arrow function body');
					}

					bodyPath.replaceWith(blockStatement);

					// Stop traversing up since we've found and fixed the arrow function
					break;
				}
			}

			currentPath = currentPath.parentPath;
		}
	},
};


export const preprocess: VisitNodeFunction<PluginPass, t.Program> = (path): void => {
	path.traverse(ensureValidJSXNesting);
	path.traverse(ensureValidFunctionsReturningJSX);
};


/**
 * Strips all compiler-only helper calls like `as.prop(x)`, `as.bool(x)`, and `as.tag(x)`.
 *
 * These helpers are declared as type-only globals and must never survive into emitted JS.
 * This runs AFTER JSX transformation, so the JSX transformer has already used as.prop() and
 * as.bool() to determine the correct part types (BooleanPart, PropertyPart, etc).
 */
const stripCompilerOnlyAsHelpers: TraverseOptions = {
	CallExpression(path) {
		const { node } = path;

		if (!t.isMemberExpression(node.callee))
			return;

		if (!t.isIdentifier(node.callee.object) || node.callee.object.name !== 'as')
			return;

		if (!t.isIdentifier(node.callee.property))
			return;

		const name = node.callee.property.name;
		if (name !== 'prop' && name !== 'bool' && name !== 'tag')
			return;

		if (node.arguments.length !== 1)
			return;

		const arg = node.arguments[0];
		if (!t.isExpression(arg))
			return;

		// Strip all as.* helper calls after JSX transformation
		path.replaceWith(arg);
	},
};

export const postprocess: VisitNodeFunction<PluginPass, t.Program> = (path): void => {
	path.traverse(stripCompilerOnlyAsHelpers);
};
