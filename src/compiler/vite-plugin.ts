/**
 * @fileoverview Vite plugin for lit-jsx preserve-JSX compilation mode.
 *
 * This plugin provides compile-time JSX transformation using Babel to convert
 * JSX syntax directly into optimized Lit templates. Unlike the React compatibility
 * mode, this preserves JSX through the entire build pipeline for maximum performance.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { litJsx } from "@arcmantle/lit-jsx/vite-jsx-preserve";
 *
 * export default {
 *   plugins: [litJsx({
 *     babel: {
 *       // Custom Babel options
 *     }
 *   })]
 * };
 * ```
 */

import * as babel from '@babel/core';
import { mergeAndConcat } from 'merge-anything';
import type { PluginOption } from 'vite';

import { litJsxBabelPreset } from './babel-preset.js';
import { babelPlugins, debugMode } from './config.js';


/**
 * Vite plugin for jsx-lit with preserve-JSX compilation.
 *
 * This plugin uses Babel to transform JSX directly into Lit templates at build time,
 * providing optimal performance by eliminating runtime JSX processing entirely.
 *
 * @param options - Configuration options for the plugin
 * @param options.babel - Babel transform options or function returning options
 * @returns Vite plugin configuration
 */
export const litJsx = (options: {
	debug?: boolean; // Enable debug mode for additional logging
	/** Options for the Babel transform */
	babel?:
		| babel.TransformOptions
		| ((code: string, id: string) => babel.TransformOptions | Promise<babel.TransformOptions>);
} = {}): PluginOption => {
	let projectRoot: string;

	debugMode.value = !!options.debug;

	return {
		name:   'lit-jsx-preserve',
		config: {
			order: 'pre',
			handler(userConfig, env) {
				projectRoot = userConfig.root ?? process.cwd();
			},
		},
		transform: {
			filter: {
				id:   [ '**/*.jsx', '**/*.tsx' ],
				code: [ '/>', '</' ],
			},
			order: 'pre',
			async handler(source, id) {
				// Default value for babel user options
				let babelUserOptions: babel.TransformOptions = {};

				if (options.babel) {
					if (typeof options.babel === 'function') {
						const babelOptions = options.babel(source, id);
						babelUserOptions = babelOptions instanceof Promise
							? await babelOptions
							: babelOptions;
					}
					else {
						babelUserOptions = options.babel;
					}
				}

				const babelOptions: babel.TransformOptions = {
					root:           projectRoot,
					filename:       id,
					sourceFileName: id,
					presets:        [
						[
							litJsxBabelPreset,
							/* merged into the metadata obj through state.opts */
							{},
						],
					],
					plugins:    [],
					ast:        false,
					sourceMaps: true,
					configFile: false,
					babelrc:    false,
					parserOpts: {
						plugins: babelPlugins,
					},
				};

				const opts = mergeAndConcat(babelUserOptions, babelOptions);
				const result = await babel.transformAsync(source, opts);

				if (result?.code)
					return { code: result.code, map: result.map };
			},
		},
	};
};
