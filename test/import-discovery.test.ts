import * as babel from '@babel/core';
import { suite, test } from 'vitest';

import { babelPlugins } from '../src/compiler/config.ts';
import { ImportDiscovery, isDynamicOrCustomElement } from '../src/compiler/import-discovery.ts';


suite('Import Discovery Tests', () => {
	const getOpts = (result: { definition: boolean; }): babel.TransformOptions => {
		ImportDiscovery.programCache.clear();
		ImportDiscovery.resolvedCache.clear();

		return {
			filename: import.meta.filename,
			plugins:  [
				{
					visitor: {
						JSXOpeningElement(path) {
							result.definition = isDynamicOrCustomElement(path);
						},
					},
				},
			],
			ast:        false,
			sourceMaps: true,
			configFile: false,
			babelrc:    false,
			parserOpts: {
				plugins: Array.from(babelPlugins),
			},
		};
	};

	test('can discover a class declaration as custom element', ({ expect }) => {
		const source = `
			class CustomElement extends HTMLElement {}
			const DiscoveryTest = CustomElement;

			const template = (
				<DiscoveryTest />
			);
		`;

		const result: { definition: boolean; } = { definition: false };
		babel.transformSync(source, getOpts(result))?.code;

		expect(result.definition).to.be.true;
	});

	test('can discover a class expression as custom element', ({ expect }) => {
		const source = `
			const DiscoveryTest = class extends HTMLElement {};

			const template = (
				<DiscoveryTest />
			);
		`;

		const result: { definition: boolean; } = { definition: false };
		babel.transformSync(source, getOpts(result))?.code;

		expect(result.definition).to.be.true;
	});

	test('can discover a string literal as static element', ({ expect }) => {
		const source = `
			const Tag = 'my-custom-element';

			const template = (
				<Tag />
			);
		`;

		const result: { definition: boolean; } = { definition: false };
		babel.transformSync(source, getOpts(result))?.code;

		expect(result.definition).to.be.true;
	});

	test('can discover a template literal as static element', ({ expect }) => {
		const source = `
			const Tag = \`my-custom-element\`;

			const template = (
				<Tag />
			);
		`;

		const result: { definition: boolean; } = { definition: false };
		babel.transformSync(source, getOpts(result))?.code;

		expect(result.definition).to.be.true;
	});

	test('can discover custom elements', ({ expect }) => {
		const source = `
			import { DiscoveryTest } from './import-discovery/import-discovery.ts';

			const template = (
				<DiscoveryTest />
			);
		`;

		const result: { definition: boolean; } = { definition: false };
		babel.transformSync(source, getOpts(result))?.code;

		expect(result.definition).to.be.true;
	});

	test('can discover a string literal with variable reassignment', ({ expect }) => {
		const source = `
			const originalTag = 'discovery-test';
			const Tag = originalTag;
			const template = () => <Tag />;
		`;

		const result: { definition: boolean; } = { definition: false };
		babel.transformSync(source, getOpts(result))?.code;

		expect(result.definition).to.be.true;
	});

	test('can discover a class with variable reassignment chain', ({ expect }) => {
		const source = `
			class MyElement extends HTMLElement {}
			const Intermediate = MyElement;
			const FinalElement = Intermediate;

			const template = (
				<FinalElement />
			);
		`;

		const result: { definition: boolean; } = { definition: false };
		babel.transformSync(source, getOpts(result))?.code;

		expect(result.definition).to.be.true;
	});

	test('can discover through export reassignment and variable substitution.', ({ expect }) => {
		const source = `
			import { FinalElement } from './import-discovery/barrel-export.ts';

			const template = (
				<FinalElement />
			);
		`;

		const result: { definition: boolean; } = { definition: false };
		babel.transformSync(source, getOpts(result))?.code;

		expect(result.definition).to.be.true;
	});

	test('ignores function calls that return unknown types', ({ expect }) => {
		const source = `
			function createComponent() {
				return class extends HTMLElement {};
			}

			const MyElement = createComponent();

			const template = (
				<MyElement />
			);
		`;

		const result: { definition: boolean; } = { definition: false };
		babel.transformSync(source, getOpts(result))?.code;

		// We can't determine the return type without type checking
		expect(result.definition).to.be.false;
	});
});
