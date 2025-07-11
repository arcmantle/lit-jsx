import * as babel from '@babel/core';
import { suite, test } from 'vitest';

import { type ElementDefinition, findElementDefinition } from '../src/compiler/import-discovery.ts';
import type { BabelPlugins } from './utils.ts';


suite('Import Discovery Tests', () => {
	const getOpts = (result: { definition: ElementDefinition; }): babel.TransformOptions => {
		return ({
			root:           '.',
			filename:       import.meta.filename,
			sourceFileName: import.meta.filename,
			plugins:        [
				{
					visitor: {
						JSXOpeningElement(path) {
							result.definition = findElementDefinition(path);
						},
					},
				},
			],
			ast:        false,
			sourceMaps: true,
			configFile: false,
			babelrc:    false,
			parserOpts: {
				plugins: [ 'jsx', 'typescript' ] satisfies BabelPlugins,
			},
		});
	};

	test('can discover custom elements', async ({ expect }) => {
		const source = `
			import { DiscoveryTest } from './import-discovery/import-discovery.ts';

			class LocalClass extends HTMLElement {
				static tagName = 'local-class';
			}

			const template = (
				<DiscoveryTest />
			);
		`;

		const result: { definition: ElementDefinition; } = { definition: { type: 'unknown' } };
		(await babel.transformAsync(source, getOpts(result)))?.code;

		// The console.log outputs will show you the traversal results
		//console.log('Final transformed code:', code);
	});

	test('can discover reassigned and re-exported toJSX elements', async ({ expect }) => {
		// This test uses real files created in the complex-scenario directory:
		// - actual-component.ts: contains the toJSX call
		// - reassign-file.ts: imports and reassigns the element
		// - barrel-export.ts: re-exports with a new name

		// Main test source that imports the final element
		const source = `
			import { FinalElement } from './import-discovery/barrel-export.ts';

			const template = (
				<FinalElement />
			);
		`;

		const result: { definition: ElementDefinition; } = { definition: { type: 'unknown' } };
		(await babel.transformAsync(source, getOpts(result)))?.code;

		// The console.log outputs will show the full tracing chain:
		// FinalElement -> ReassignedElement -> ActualElement -> toJSX(MyActualComponent)
		console.log('Test completed - check console output for tracing results');
	});

	test('can discover minified/renamed toComponent calls with local exports', async ({ expect }) => {
		// This test uses the minified-example.ts file which simulates:
		// import { toComponent as f } from '@arcmantle/lit-jsx';
		// const v = f(Badge);
		// export { v as BadgeCmp };

		const source = `
			import { BadgeCmp } from './import-discovery/minified-entry.ts';

			const template = (
				<BadgeCmp />
			);
		`;

		const result: { definition: ElementDefinition; } = { definition: { type: 'unknown' } };
		(await babel.transformAsync(source, getOpts(result)))?.code;

		// Should successfully trace:
		// BadgeCmp -> v -> f(Badge) where f is renamed toComponent
		expect(result.definition.type).toBe('custom-element');
		expect(result.definition.source?.includes('minified-example.ts')).toBe(true);
		expect(result.definition.callExpression).toBeDefined();
	});
});
