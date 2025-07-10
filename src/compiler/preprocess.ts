import type { PluginPass } from '@babel/core';
import type { NodePath, VisitNodeFunction } from '@babel/traverse';
import type { JSXElement, Program } from '@babel/types';
import { isJSXElement, isJSXIdentifier } from '@babel/types';
import { isValidHTMLNesting } from 'validate-html-nesting';

import { isComponent } from './compiler-utils.js';


const preprocessVisitors = {
	// From https://github.com/MananTank/babel-plugin-validate-jsx-nesting/blob/main/src/index.js
	// Validates JSX nesting based on HTML5 rules.
	JSXElement(path: NodePath<JSXElement>) {
		const elName = path.node.openingElement.name;
		const parent = path.parent;

		if (!isJSXElement(parent) || !isJSXIdentifier(elName))
			return;

		const elTagName = elName.name;
		if (isComponent(elTagName))
			return;

		const parentElName = parent.openingElement.name;
		if (!isJSXIdentifier(parentElName))
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


export const preprocess: VisitNodeFunction<PluginPass, Program> = (path): void => {
	path.traverse(preprocessVisitors);
};
