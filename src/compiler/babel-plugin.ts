import type { PluginItem, PluginOptions, PluginTarget } from '@babel/core';
import SyntaxJSX from '@babel/plugin-syntax-jsx';

import { initializePluginOptions } from './config.js';
import { preprocess } from './preprocess.js';
import { transformJSXElement } from './transform-jsx.js';


/** Compiles jsx to a combination of standard and compiled lit-html */
export const litJsxBabelPlugin = (options: {
	useCompiledTemplates?: boolean;
	useImportDiscovery?:   boolean;
}): [PluginTarget, PluginOptions] => {
	return [
		{
			name:     'lit-jsx-transform',
			inherits: SyntaxJSX.default,
			visitor:  {
				JSXElement:  transformJSXElement,
				JSXFragment: transformJSXElement,
				Program:     {
					enter: preprocess,
				},
			},
			pre(file) {
				initializePluginOptions(file);
			},
		} satisfies PluginItem,
		options,
	];
};
