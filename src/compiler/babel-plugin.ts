import type { PluginItem } from '@babel/core';
import SyntaxJSX from '@babel/plugin-syntax-jsx';

import { preprocess } from './preprocess.js';
import { transformJSXElement } from './transform-jsx.js';


/** Compiles jsx to a combination of standard and compiled lit-html */
export const litJsxBabelPlugin = (): PluginItem => {
	return {
		name:     'lit-jsx-transform',
		inherits: SyntaxJSX.default,
		visitor:  {
			JSXElement:  transformJSXElement,
			JSXFragment: transformJSXElement,
			Program:     {
				enter: preprocess,
			},
		},
	} satisfies PluginItem;
};
