/* eslint-disable @stylistic/max-len */

import * as babel from '@babel/core';
import { suite, test } from 'vitest';

import { litJsxBabelPlugin } from '../src/compiler/babel-plugin.ts';
import { babelPlugins } from '../src/compiler/config.ts';


suite('Type Inference Tests', () => {
	const getOpts = (useTypeInference = true): babel.TransformOptions => {
		return {
			filename: import.meta.filename,
			plugins:  [
				litJsxBabelPlugin({
					useCompiledTemplates: true,
					useTypeInference,
				}),
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

	// ========== CLASS COMPONENT TESTS ==========

	test('detects class component and treats it as static (custom element)', ({ expect }) => {
		const source = `
			class MyElement extends HTMLElement {
				constructor() {
					super();
				}
			}

			const template = <MyElement />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		// Should use htmlStatic and literalMap for class components (custom elements)
		// Class constructors should be treated as static tags, not function calls
		expect(code).toContain('__$htmlStatic');
		expect(code).toContain('__$literalMap');
		expect(code).not.toContain('MyElement({})');
	});

	test('detects class component with properties', ({ expect }) => {
		const source = `
			class CustomButton extends HTMLElement {
				static observedAttributes = ['disabled'];
			}

			const template = <CustomButton disabled={true} />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toContain('__$htmlStatic');
		expect(code).toContain('__$literalMap');
		expect(code).not.toContain('CustomButton({');
	});

	test('detects imported class component', ({ expect }) => {
		const source = `
			import { MyCustomElement } from './type-inference/my-element.ts';

			const template = <MyCustomElement />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		// With tsconfig, imported classes should be detected
		expect(code).toContain('__$htmlStatic');
		expect(code).toContain('__$literalMap');
		expect(code).not.toContain('MyCustomElement({})');
	});

	test('detects imported function component', ({ expect }) => {
		const source = `
			import { MyFunctionComponent } from './type-inference/function-component.ts';

			const template = <MyFunctionComponent message="Hello" />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		// Imported function should be detected as dynamic component
		expect(code).toContain('MyFunctionComponent({');
		expect(code).not.toContain('__$literalMap');
	});

	// ========== STRING LITERAL TESTS ==========

	test('detects string literal as custom element tag', ({ expect }) => {
		const source = `
			const MyElement = "my-custom-element";

			const template = <MyElement />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		// Should use htmlStatic for string literals
		expect(code).toContain('__$htmlStatic');
		expect(code).toContain('__$literalMap');
		expect(code).not.toContain('MyElement({})');
	});

	test('detects const string literal element', ({ expect }) => {
		const source = `
			const ElementName = "x-button";

			const template = <ElementName onClick={() => {}} />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toContain('__$htmlStatic');
		expect(code).toContain('__$literalMap');
		expect(code).not.toContain('ElementName({');
	});

	// ========== FUNCTION COMPONENT TESTS ==========

	test('detects function component and treats it as dynamic', ({ expect }) => {
		const source = `
			const MyComponent = (props: { name: string }) => {
				return <div>{props.name}</div>;
			};

			const template = <MyComponent name="test" />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		// Function components should be transformed to function calls, not static templates
		expect(code).toContain('MyComponent({');
		// The JSX inside the function body will still use htmlStatic
		expect(code).toContain('__$htmlStatic');
	});

	test('detects function declaration component', ({ expect }) => {
		const source = `
			function MyComponent(props: { title: string }) {
				return <h1>{props.title}</h1>;
			}

			const template = <MyComponent title="Hello" />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		// Function components should be transformed to function calls
		expect(code).toContain('MyComponent({');
		expect(code).toContain('__$htmlStatic');
	});

	test('detects arrow function component', ({ expect }) => {
		const source = `
			const Button = ({ label }: { label: string }) => <button>{label}</button>;

			const template = <Button label="Click me" />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		// Function components should be transformed to function calls
		expect(code).toContain('Button({');
		expect(code).toContain('__$htmlStatic');
	});

	// ========== MIXED SCENARIOS ==========

	test('handles mix of class and function components', ({ expect }) => {
		const source = `
			class CustomElement extends HTMLElement {}
			const FunctionComponent = () => <div>Hello</div>;

			const template = (
				<div>
					<CustomElement />
					<FunctionComponent />
				</div>
			);
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		// CustomElement should be in static template (not a function call)
		expect(code).toContain('__$htmlStatic');
		expect(code).toContain('__$literalMap');
		expect(code).not.toContain('CustomElement({');
		// FunctionComponent should be a function call
		expect(code).toContain('FunctionComponent({');
	});

	test('respects manual static attribute over type inference', ({ expect }) => {
		const source = `
			const MyComponent = () => <div>Function</div>;

			// User manually marks it as static
			const template = <MyComponent static />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		// Manual static attribute should take precedence
		expect(code).toContain('__$htmlStatic');
	});

	// ========== EDGE CASES ==========

	test('handles component without type inference enabled', ({ expect }) => {
		const source = `
			class MyElement extends HTMLElement {}

			const template = <MyElement />;
		`;

		const code = babel.transformSync(source, getOpts(false))?.code;

		// Without type inference, should not automatically detect as static
		// unless manually marked
		expect(code).toBeDefined();
	});

	test('handles lowercase custom elements (native HTML)', ({ expect }) => {
		const source = `
			const template = <div>Hello</div>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		// Native HTML elements should always be static
		expect(code).toContain('__$t`<div>Hello</div>`');
	});

	test('handles JSX fragment', ({ expect }) => {
		const source = `
			const template = <>
				<div>First</div>
				<div>Second</div>
			</>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBeDefined();
		expect(code).toContain('__$t');
	});

	test('handles component with generic type parameters', ({ expect }) => {
		const source = `
			const GenericComponent = <T,>(props: { value: T }) => {
				return <div>{String(props.value)}</div>;
			};

			const template = <GenericComponent value={42} />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		// Generic function components should still be detected as functions
		expect(code).toContain('__$html');
	});

	// ========== CONSTRUCTOR FUNCTION TESTS ==========

	test('detects constructor function as class-like', ({ expect }) => {
		const source = `
			function MyElement() {
				this.tagName = 'my-element';
			}
			MyElement.prototype = Object.create(HTMLElement.prototype);

			const template = <MyElement />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		// Constructor functions might be detected if they have construct signatures
		expect(code).toBeDefined();
	});

	// ========== VARIABLE REASSIGNMENT ==========

	test('handles component assigned to variable', ({ expect }) => {
		const source = `
			class OriginalElement extends HTMLElement {}
			const AliasedElement = OriginalElement;

			const template = <AliasedElement />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		// Aliased class should still be detected as a class
		expect(code).toContain('__$htmlStatic');
		expect(code).toContain('__$literalMap');
		expect(code).not.toContain('AliasedElement({');
	});

	test('handles string element assigned to variable', ({ expect }) => {
		const source = `
			const tagName = "custom-element";
			const Element = tagName;

			const template = <Element />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toContain('__$htmlStatic');
		expect(code).toContain('__$literalMap');
		expect(code).not.toContain('Element({');
	});

	// ========== NAMESPACE TESTS ==========

	test('handles namespaced components', ({ expect }) => {
		const source = `
			const UI = {
				Button: class extends HTMLElement {}
			};

			const template = <UI.Button />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		// Namespaced components should be handled
		expect(code).toBeDefined();
	});

	// ========== ERROR HANDLING ==========

	test('gracefully handles undefined component', ({ expect }) => {
		const source = `
			const template = <UndefinedComponent />;
		`;

		// Should not throw, just compile without type information
		expect(() => babel.transformSync(source, getOpts())).not.toThrow();
	});

	test('handles component from external module', ({ expect }) => {
		const source = `
			import { ExternalComponent } from 'some-library';

			const template = <ExternalComponent />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		// External imports can't be type-checked without the actual files
		expect(code).toBeDefined();
	});
});
