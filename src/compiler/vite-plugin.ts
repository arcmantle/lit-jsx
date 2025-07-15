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
import { deepmerge } from 'deepmerge-ts';
import type { EnvironmentModuleNode, PluginOption } from 'vite';

import { litJsxBabelPlugin } from './babel-plugin.js';
import { babelPlugins, debugMode } from './config.js';
import { ImportDiscovery } from './import-discovery.js';


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
	legacyDecorators?: boolean; // Enable legacy decorators support
	debug?:            boolean; // Enable debug mode for additional logging
	/** Options for the Babel transform */
	babel?:
		| babel.TransformOptions
		| ((code: string, id: string) => babel.TransformOptions | Promise<babel.TransformOptions>);
} = {}): PluginOption => {
	let projectRoot: string;

	debugMode.value = !!options.debug;

	if (options.legacyDecorators) {
		babelPlugins.delete('decorators');
		babelPlugins.delete('decoratorAutoAccessors');

		babelPlugins.add('decorators-legacy');
	}

	const finalBabelPlugins = Array.from(babelPlugins);

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
				const babelUserOptions = options.babel
					? await resolveAwaitableFunction(options.babel, source, id)
					: {};

				const babelOptions: babel.TransformOptions = {
					root:           projectRoot,
					filename:       id,
					sourceFileName: id,
					plugins:        [ litJsxBabelPlugin() ],
					ast:            false,
					sourceMaps:     true,
					configFile:     false,
					babelrc:        false,
					parserOpts:     {
						plugins: finalBabelPlugins,
					},
				};

				try {
					const opts = deepmerge(babelUserOptions, babelOptions);

					//console.time(`Babel transform ${ id }`);
					const result = (await babel.transformAsync(source, opts))!;
					//console.timeEnd(`Babel transform ${ id }`);

					return {
						code: result.code!,
						map:  result.map!,
					};
				}
				catch (error) {
					console.error(`Error transforming ${ id } with lit-jsx:`, error);
				}
			},
		},
		hotUpdate: {
			handler(ctx) {
				// Only process files that our transform handles
				if (!ctx.file.match(/\.(jsx|tsx)$/))
					return;

				const moduleGraph = ctx.server.environments.client.moduleGraph;

				// Get all modules that import this file (reverse dependency chain)
				const changedModule = moduleGraph.getModuleById(ctx.file);
				if (!changedModule)
					return;

				// Only process if there are actual importers
				if (changedModule.importers.size === 0)
					return ImportDiscovery.clearCacheForFile(ctx.file);

				// Collect all importers recursively
				const getAllImporters = (
					module: EnvironmentModuleNode,
					visited = new Set<string>(),
				): Set<string> => {
					const importers: Set<string> = new Set();

					if (!module.id || visited.has(module.id))
						return importers;

					visited.add(module.id);

					for (const importer of module.importers) {
						if (!importer.id)
							continue;

						importers.add(importer.id);

						// Recursively get importers of importers
						const nestedImporters = getAllImporters(importer, visited);
						nestedImporters.forEach(id => importers.add(id));
					}

					return importers;
				};

				const allAffectedFiles = getAllImporters(changedModule);
				allAffectedFiles.add(ctx.file);

				// Get ModuleNode objects for all affected files and invalidate them
				const affectedModules: EnvironmentModuleNode[] = [];
				for (const fileId of allAffectedFiles) {
					ImportDiscovery.clearCacheForFile(fileId);

					const module = moduleGraph.getModuleById(fileId);
					if (module)
						affectedModules.push(module);
				}

				// Return the affected modules to trigger HMR update
				return affectedModules;
			},
		},
	} satisfies PluginOption;
};


const resolveAwaitableFunction = async <Fn>(
	fn: Fn,
	...args: Fn extends (...args: any[]) => any ? Parameters<Fn> : never
): Promise<Fn extends (...args: any[]) => any ? ReturnType<Fn> : never> => {
	if (typeof fn === 'function') {
		const result = fn(...args);

		return result instanceof Promise
			? await result
			: result;
	}

	return fn as any;
};
