import type { PluginItem, PluginOptions, PluginTarget } from '@babel/core';
import SyntaxJSX from '@babel/plugin-syntax-jsx';

import { initializePluginOptions } from './config.js';
import { postprocess, preprocess } from './preprocess.js';
import { transformJSXElement } from './transform-jsx.js';
import { cleanupTypeInference, initializeTypeInference } from './ts-program-manager.js';


/** Compiles jsx to a combination of standard and compiled lit-html */
export const litJsxBabelPlugin = (options: {
	useCompiledTemplates?: boolean;
	useImportDiscovery?:   boolean;
	useTypeInference?:     boolean;
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
					exit:  postprocess,
				},
			},
			pre(file) {
				initializePluginOptions(file);

				if (options.useTypeInference)
					initializeTypeInference(file);
			},
			post() {
				if (options.useTypeInference)
					cleanupTypeInference();
			},
		} satisfies PluginItem,
		options,
	];
};
