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

	test('can discover a locally defined custom element', ({ expect }) => {
		const source = `
			import { toComponent } from '@arcmantle/lit-jsx';

			class CustomElement extends HTMLElement {}
			const DiscoveryTest = toComponent(CustomElement);

			const template = (
				<DiscoveryTest />
			);
		`;

		const result: { definition: boolean; } = { definition: false };
		babel.transformSync(source, getOpts(result))?.code;

		expect(result.definition).to.be.true;
	});

	test('can discover a locally defined custom element with reassigned callExpr', ({ expect }) => {
		const source = `
			import { toComponent } from '@arcmantle/lit-jsx';

			class CustomElement extends HTMLElement {}
			let DiscoveryTest2 = toComponent(CustomElement);
			let DiscoveryTest = DiscoveryTest2;

			const template = (
				<DiscoveryTest />
			);
		`;

		const result: { definition: boolean; } = { definition: false };
		babel.transformSync(source, getOpts(result))?.code;

		expect(result.definition).to.be.true;
	});

	test('can discover a locally defined custom element with renamed import', ({ expect }) => {
		const source = `
			import { toComponent as renamed } from '@arcmantle/lit-jsx';

			class CustomElement extends HTMLElement {}
			let DiscoveryTest = renamed(CustomElement);

			const template = (
				<DiscoveryTest />
			);
		`;

		const result: { definition: boolean; } = { definition: false };
		babel.transformSync(source, getOpts(result))?.code;

		expect(result.definition).to.be.true;
	});

	test('can discovery a custom element from a function parameter with type annotation', ({ expect }) => {
		const source = `
			import { toComponent } from '@arcmantle/lit-jsx';

			const DiscoveryTest = toComponent(new class extends HTMLElement {});

			const template = (Element: typeof DiscoveryTest) => <Element />;
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

	test('can discover a root declared tag element', ({ expect }) => {
		const source = `
			import { toTag } from '@arcmantle/lit-jsx';

			const Tag = toTag('discovery-test');
			const template = () => <Tag />;
		`;

		const result: { definition: boolean; } = { definition: false };
		babel.transformSync(source, getOpts(result))?.code;

		expect(result.definition).to.be.true;
	});

	test('can discover a scoped tag element', ({ expect }) => {
		const source = `
			import { toTag } from '@arcmantle/lit-jsx';

			const template = () => {
				const Tag = toTag('discovery-test');

				return (
					<Tag />
				)
			};
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

	test('can discover minified/renamed toComponent calls with local exports', ({ expect }) => {
		const source = `
			import { BadgeCmp } from './import-discovery/minified-example.ts';

			const template = (
				<BadgeCmp />
			);
		`;

		const result: { definition: boolean; } = { definition: false };
		babel.transformSync(source, getOpts(result))?.code;

		expect(result.definition).to.be.true;
	});

	test('can discover minified/renamed toComponent calls with barrel exports', ({ expect }) => {
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

		const result: { definition: boolean; } = { definition: false };
		babel.transformSync(source, getOpts(result))?.code;

		expect(result.definition).to.be.true;
	});
});
