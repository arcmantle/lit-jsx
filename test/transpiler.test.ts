/* eslint-disable @stylistic/max-len */

import * as babel from '@babel/core';
import { suite, test } from 'vitest';

import { litJsxBabelPlugin } from '../src/compiler/babel-plugin.ts';
import { babelPlugins } from '../src/compiler/config.ts';
import { ImportDiscovery } from '../src/compiler/import-discovery.ts';
import { dedent } from './utils.ts';


suite('JSX to Lit Transpiler Tests', () => {
	const getOpts = (): babel.TransformOptions => {
		ImportDiscovery.programCache.clear();
		ImportDiscovery.resolvedCache.clear();

		return {
			filename:   import.meta.filename,
			plugins:    [ litJsxBabelPlugin({ useCompiledTemplates: true }) ],
			ast:        false,
			sourceMaps: true,
			configFile: false,
			babelrc:    false,
			parserOpts: {
				plugins: Array.from(babelPlugins),
			},
		};
	};

	// ========== BASIC ELEMENT TESTS ==========

	test('transforms empty fragment', ({ expect }) => {
		const source = `
			const template = <></>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`\`,
			  "parts": []
			};
			const template = {
			  "_$litType$": _temp,
			  "values": []
			};
		`));
	});

	test('transforms div with static text content', ({ expect }) => {
		const source = `
		const template = <div>Static text content</div>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<div>Static text content</div>\`,
			  "parts": []
			};
			const template = {
			  "_$litType$": _temp,
			  "values": []
			};
		`));
	});

	test('transforms self-closing element', ({ expect }) => {
		const source = `
		const template = <input type="text" />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<input type="text"></input>\`,
			  "parts": []
			};
			const template = {
			  "_$litType$": _temp,
			  "values": []
			};
		`));
	});

	// ========== EXPRESSION TESTS ==========

	test('transforms element with single expression', ({ expect }) => {
		const source = `
		const name = 'World';
		const template = <div>Hello {name}</div>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<div>Hello<?></div>\`,
			  "parts": [{
			    "type": 2,
			    "index": 1
			  }]
			};
			const name = 'World';
			const template = {
			  "_$litType$": _temp,
			  "values": [name]
			};
		`));
	});

	test('transforms element with multiple expressions', ({ expect }) => {
		const source = `
		const first = 'Hello';
		const second = 'World';
		const template = <div>{first} {second}</div>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<div><?><?></div>\`,
			  "parts": [{
			    "type": 2,
			    "index": 1
			  }, {
			    "type": 2,
			    "index": 1
			  }]
			};
			const first = 'Hello';
			const second = 'World';
			const template = {
			  "_$litType$": _temp,
			  "values": [first, second]
			};
		`));
	});

	test('transforms element with complex expression', ({ expect }) => {
		const source = `
		const user = { name: 'John', age: 30 };
		const template = <div>User: {user.name} ({user.age} years old)</div>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<div>User:<?>(<?>years old)</div>\`,
			  "parts": [{
			    "type": 2,
			    "index": 1
			  }, {
			    "type": 2,
			    "index": 1
			  }]
			};
			const user = {
			  name: 'John',
			  age: 30
			};
			const template = {
			  "_$litType$": _temp,
			  "values": [user.name, user.age]
			};
		`));
	});

	test('transforms element with conditional expression', ({ expect }) => {
		const source = `
		const isLoggedIn = true;
		const template = <div>{isLoggedIn ? 'Welcome' : 'Please log in'}</div>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<div><?></div>\`,
			  "parts": [{
			    "type": 2,
			    "index": 1
			  }]
			};
			const isLoggedIn = true;
			const template = {
			  "_$litType$": _temp,
			  "values": [isLoggedIn ? 'Welcome' : 'Please log in']
			};
		`));
	});

	// ========== ATTRIBUTE TESTS ==========

	test('transforms element with static attributes', ({ expect }) => {
		const source = `
		const template = <div class="container" id="main">Content</div>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<div class="container" id="main">Content</div>\`,
			  "parts": []
			};
			const template = {
			  "_$litType$": _temp,
			  "values": []
			};
		`));
	});

	test('transforms element with dynamic attribute', ({ expect }) => {
		const source = `
		const className = 'dynamic-class';
		const template = <div class={className}>Content</div>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t, AttributePart } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<div>Content</div>\`,
			  "parts": [{
			    "type": 1,
			    "index": 0,
			    "name": "class",
			    "strings": ["", ""],
			    "ctor": AttributePart
			  }]
			};
			const className = 'dynamic-class';
			const template = {
			  "_$litType$": _temp,
			  "values": [className]
			};
		`));
	});

	test('transforms element with boolean attribute (arrow function)', ({ expect }) => {
		const source = `
		const isDisabled = true;
		const template = <button disabled={bool => isDisabled}>Click me</button>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t, BooleanPart } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<button>Click me</button>\`,
			  "parts": [{
			    "type": 1,
			    "index": 0,
			    "name": "disabled",
			    "strings": ["", ""],
			    "ctor": BooleanPart
			  }]
			};
			const isDisabled = true;
			const template = {
			  "_$litType$": _temp,
			  "values": [isDisabled]
			};
		`));
	});

	test('transforms element with boolean attribute (as.bool)', ({ expect }) => {
		const source = `
		const isDisabled = true;
		const template = <button disabled={as.bool(isDisabled)}>Click me</button>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t, BooleanPart } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<button>Click me</button>\`,
			  "parts": [{
			    "type": 1,
			    "index": 0,
			    "name": "disabled",
			    "strings": ["", ""],
			    "ctor": BooleanPart
			  }]
			};
			const isDisabled = true;
			const template = {
			  "_$litType$": _temp,
			  "values": [isDisabled]
			};
		`));
	});

	test('transforms element with property assignment (arrow function)', ({ expect }) => {
		const source = `
		const value = 'test-value';
		const template = <input value={prop => value} />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t, PropertyPart } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<input></input>\`,
			  "parts": [{
			    "type": 1,
			    "index": 0,
			    "name": "value",
			    "strings": ["", ""],
			    "ctor": PropertyPart
			  }]
			};
			const value = 'test-value';
			const template = {
			  "_$litType$": _temp,
			  "values": [value]
			};
		`));
	});

	test('transforms element with property assignment (as.prop)', ({ expect }) => {
		const source = `
		const value = 'test-value';
		const template = <input value={as.prop(value)} />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t, PropertyPart } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<input></input>\`,
			  "parts": [{
			    "type": 1,
			    "index": 0,
			    "name": "value",
			    "strings": ["", ""],
			    "ctor": PropertyPart
			  }]
			};
			const value = 'test-value';
			const template = {
			  "_$litType$": _temp,
			  "values": [value]
			};
		`));
	});

	test('transforms element with mixed attribute types', ({ expect }) => {
		const source = `
		const className = 'dynamic';
		const isDisabled = true;
		const value = 'input-value';
		const template = (
			<input
				type="text"
				class={className}
				disabled={bool => isDisabled}
				value={prop => value}
			/>
		);
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t, AttributePart, BooleanPart, PropertyPart } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<input type="text"></input>\`,
			  "parts": [{
			    "type": 1,
			    "index": 0,
			    "name": "class",
			    "strings": ["", ""],
			    "ctor": AttributePart
			  }, {
			    "type": 1,
			    "index": 0,
			    "name": "disabled",
			    "strings": ["", ""],
			    "ctor": BooleanPart
			  }, {
			    "type": 1,
			    "index": 0,
			    "name": "value",
			    "strings": ["", ""],
			    "ctor": PropertyPart
			  }]
			};
			const className = 'dynamic';
			const isDisabled = true;
			const value = 'input-value';
			const template = {
			  "_$litType$": _temp,
			  "values": [className, isDisabled, value]
			};
		`));
	});

	// ========== CUSTOM ELEMENT TESTS ==========

	test('transforms simple custom element', ({ expect }) => {
		const source = `
		import { toTag } from "@arcmantle/lit-jsx";

		const Button = toTag('custom-button');
		const template = <Button>Click me</Button>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { html as htmlStatic } from "lit-html/static.js";
			import { toTag, __$literalMap } from "@arcmantle/lit-jsx";
			const Button = toTag('custom-button');
			const __$Button = __$literalMap.get(Button);
			const template = htmlStatic\`<\${__$Button}>Click me</\${__$Button}>\`;
		`));
	});

	test('transforms custom element with attributes', ({ expect }) => {
		const source = `
		import { toTag } from "@arcmantle/lit-jsx";

		const Button = toTag('custom-button');
		const template = <Button type="submit" variant="primary">Submit</Button>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { html as htmlStatic } from "lit-html/static.js";
			import { toTag, __$literalMap } from "@arcmantle/lit-jsx";
			const Button = toTag('custom-button');
			const __$Button = __$literalMap.get(Button);
			const template = htmlStatic\`<\${__$Button} type="submit" variant="primary">Submit</\${__$Button}>\`;
		`));
	});

	test('transforms custom element with dynamic attributes', ({ expect }) => {
		const source = `
		import { toTag } from "@arcmantle/lit-jsx";

		const Button = toTag('custom-button');
		const variant = 'primary';
		const template = <Button variant={variant}>Dynamic</Button>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { html as htmlStatic } from "lit-html/static.js";
			import { toTag, __$literalMap } from "@arcmantle/lit-jsx";
			const Button = toTag('custom-button');
			const __$Button = __$literalMap.get(Button);
			const variant = 'primary';
			const template = htmlStatic\`<\${__$Button} variant=\${variant}>Dynamic</\${__$Button}>\`;
		`));
	});

	test('transforms self-closing custom element', ({ expect }) => {
		const source = `
		import { toTag } from "@arcmantle/lit-jsx";

		const Icon = toTag('custom-button');
		const template = <Icon name="star" />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { html as htmlStatic } from "lit-html/static.js";
			import { toTag, __$literalMap } from "@arcmantle/lit-jsx";
			const Icon = toTag('custom-button');
			const __$Icon = __$literalMap.get(Icon);
			const template = htmlStatic\`<\${__$Icon} name="star"></\${__$Icon}>\`;
		`));
	});

	// ========== SVG & MATHML TESTS ==========

	test('transforms standalone SVG element', ({ expect }) => {
		const source = `
		const template = <circle cx="50" cy="50" r="40" />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { svg } from "lit-html/directives/svg.js";
			const template = svg\`<circle cx="50" cy="50" r="40"></circle>\`;
		`));
	});

	test('transforms SVG with expressions', ({ expect }) => {
		const source = `
		const radius = 40;
		const template = <circle cx="50" cy="50" r={radius} />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { svg } from "lit-html/directives/svg.js";
			const radius = 40;
			const template = svg\`<circle cx="50" cy="50" r=\${radius}></circle>\`;
		`));
	});

	test('transforms SVG wrapped in HTML', ({ expect }) => {
		const source = `
		const template = (
			<div>
				<svg width="100" height="100">
					<circle cx="50" cy="50" r="40" />
				</svg>
			</div>
		);
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<div><svg width="100" height="100"><circle cx="50" cy="50" r="40"></circle></svg></div>\`,
			  "parts": []
			};
			const template = {
			  "_$litType$": _temp,
			  "values": []
			};
		`));
	});

	test('transforms standalone MathML element', ({ expect }) => {
		const source = `
		const template = <mi>x</mi>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { mathml } from "lit-html/directives/mathml.js";
			const template = mathml\`<mi>x</mi>\`;
		`));
	});

	test('transforms complex MathML expression', ({ expect }) => {
		const source = `
		const template = (
			<mrow>
				<mi>x</mi>
				<mo>+</mo>
				<mi>y</mi>
			</mrow>
		);
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { mathml } from "lit-html/directives/mathml.js";
			const template = mathml\`<mrow><mi>x</mi><mo>+</mo><mi>y</mi></mrow>\`;
		`));
	});

	test('transforms MathML wrapped in HTML', ({ expect }) => {
		const source = `
		const template = (
			<div>
				<math>
					<mrow>
						<mi>x</mi>
						<mo>+</mo>
						<mi>y</mi>
					</mrow>
				</math>
			</div>
		);
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<div><math><mrow><mi>x</mi><mo>+</mo><mi>y</mi></mrow></math></div>\`,
			  "parts": []
			};
			const template = {
			  "_$litType$": _temp,
			  "values": []
			};
		`));
	});

	// ========== SCOPE TESTS ==========

	test('correctly finds parameter to be custom-element with typeof annotation', ({ expect }) => {
		const source = `
		const MyComponent = toComponent('my-component');
		const template = (Element: typeof MyComponent) => <Element />;
		`;
		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { html as htmlStatic } from "lit-html/static.js";
			import { __$literalMap } from "@arcmantle/lit-jsx";
			const MyComponent = toComponent('my-component');
			const template = (Element: typeof MyComponent) => {
			  const __$Element = __$literalMap.get(Element);
			  return htmlStatic\`<\${__$Element}></\${__$Element}>\`;
			};
		`));
	});

	test('correctly finds parameter to be custom-element with ToComponent annotation', ({ expect }) => {
		const source = `
		const template = (Element: ToComponent) => <Element />;
		`;
		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { html as htmlStatic } from "lit-html/static.js";
			import { __$literalMap } from "@arcmantle/lit-jsx";
			const template = (Element: ToComponent) => {
			  const __$Element = __$literalMap.get(Element);
			  return htmlStatic\`<\${__$Element}></\${__$Element}>\`;
			};
		`));
	});

	test('correctly places dynamic tag variables in function with block scope', ({ expect }) => {
		const source = `
		const template = (Element: ToComponent) => {
			return <Element />
		};
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { html as htmlStatic } from "lit-html/static.js";
			import { __$literalMap } from "@arcmantle/lit-jsx";
			const template = (Element: ToComponent) => {
			  const __$Element = __$literalMap.get(Element);
			  return htmlStatic\`<\${__$Element}></\${__$Element}>\`;
			};
		`));
	});

	// ========== FUNCTION COMPONENT TESTS ==========

	test('transforms function component with no props', ({ expect }) => {
		const source = `
		const template = <MyComponent />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;


		expect(code).toBe(dedent(`
			const template = MyComponent({});
		`));
	});

	test('transforms function component with props', ({ expect }) => {
		const source = `
		const template = <MyComponent title="Hello" count={42} />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			const template = MyComponent({
			  title: "Hello",
			  count: 42
			});
		`));
	});

	test('transforms function component with single child', ({ expect }) => {
		const source = `
		const template = (
			<MyComponent>
				<div>Single child</div>
			</MyComponent>
		);
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			const _temp = {
			  "h": __$t\`<div>Single child</div>\`,
			  "parts": []
			};
			const template = MyComponent({
			  children: {
			    "_$litType$": _temp,
			    "values": []
			  }
			});
		`));
	});

	test('transforms function component with multiple children', ({ expect }) => {
		const source = `
		const template = (
			<MyComponent>
				<div>First child</div>
				{expression}
				<span>Second child</span>
				Text content
			</MyComponent>
		);
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			const _temp2 = {
			  "h": __$t\`<span>Second child</span>\`,
			  "parts": []
			};
			const _temp = {
			  "h": __$t\`<div>First child</div>\`,
			  "parts": []
			};
			const template = MyComponent({
			  children: [{
			    "_$litType$": _temp,
			    "values": []
			  }, expression, {
			    "_$litType$": _temp2,
			    "values": []
			  }, "Text content"]
			});
		`));
	});

	test('transforms function component with expression child', ({ expect }) => {
		const source = `
		const items = ['a', 'b', 'c'];
		const template = (
			<List>
				{items.map(item => <li key={item}>{item}</li>)}
			</List>
		);
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t, AttributePart } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<li><?></li>\`,
			  "parts": [{
			    "type": 1,
			    "index": 0,
			    "name": "key",
			    "strings": ["", ""],
			    "ctor": AttributePart
			  }, {
			    "type": 2,
			    "index": 1
			  }]
			};
			const items = ['a', 'b', 'c'];
			const template = List({
			  children: items.map(item => {
			    return {
			      "_$litType$": _temp,
			      "values": [item, item]
			    };
			  })
			});
		`));
	});

	test('correctly places function component in static template', ({ expect }) => {
		const source = `
		const render = () => <>
			<s-top-actions>
				<For each={ this.activitybar }>
					{activity => <Icon url={as.prop(activity.icon)}></Icon>}
				</For>
			</s-top-actions>
			<s-bottom-actions>
				<For each={ this.activitybar }>
					{activity => <Icon url={as.prop(activity.icon)}></Icon>}
				</For>
			</s-bottom-actions>
		</>
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
		import { __$t } from "@arcmantle/lit-jsx";
		const _temp = {
		  "h": __$t\`<s-top-actions><?></s-top-actions><s-bottom-actions><?></s-bottom-actions>\`,
		  "parts": [{
		    "type": 2,
		    "index": 1
		  }, {
		    "type": 2,
		    "index": 3
		  }]
		};
		const render = () => {
		  return {
		    "_$litType$": _temp,
		    "values": [For({
		      each: this.activitybar,
		      children: activity => {
		        return Icon({
		          url: as.prop(activity.icon)
		        });
		      }
		    }), For({
		      each: this.activitybar,
		      children: activity => {
		        return Icon({
		          url: as.prop(activity.icon)
		        });
		      }
		    })]
		  };
		};
		`));
	});

	// ========== DIRECTIVE TESTS ==========

	test('transforms element with single directive', ({ expect }) => {
		const source = `
		const template = <div directive={myDirective()}>Content</div>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<div>Content</div>\`,
			  "parts": [{
			    "type": 6,
			    "index": 0
			  }]
			};
			const template = {
			  "_$litType$": _temp,
			  "values": [myDirective()]
			};
		`));
	});

	test('transforms element with multiple directives', ({ expect }) => {
		const source = `
		const template = <div directive={[directive1(), directive2()]}>Content</div>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<div>Content</div>\`,
			  "parts": [{
			    "type": 6,
			    "index": 0
			  }, {
			    "type": 6,
			    "index": 0
			  }]
			};
			const template = {
			  "_$litType$": _temp,
			  "values": [directive1(), directive2()]
			};
		`));
	});

	test('transforms element with ref directive', ({ expect }) => {
		const source = `
		const template = <div ref={this.elementRef}>Content</div>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { ref } from "lit-html/directives/ref.js";
			import { __$t } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<div>Content</div>\`,
			  "parts": [{
			    "type": 6,
			    "index": 0
			  }]
			};
			const template = {
			  "_$litType$": _temp,
			  "values": [ref(this.elementRef)]
			};
		`));
	});

	// ========== SPREAD ATTRIBUTES ==========

	test('transforms element with spread attributes', ({ expect }) => {
		const source = `
		const props = { class: 'container', id: 'main' };
		const template = <div {...props}>Content</div>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t, __$rest } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<div>Content</div>\`,
			  "parts": [{
			    "type": 6,
			    "index": 0
			  }]
			};
			const props = {
			  class: 'container',
			  id: 'main'
			};
			const template = {
			  "_$litType$": _temp,
			  "values": [__$rest(props)]
			};
		`));
	});

	test('transforms custom element with spread attributes', ({ expect }) => {
		const source = `
		const Button = toTag('custom-button');
		const props = { variant: 'primary', size: 'large' };
		const template = <Button {...props}>Submit</Button>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { html as htmlStatic } from "lit-html/static.js";
			import { __$literalMap, __$rest } from "@arcmantle/lit-jsx";
			const Button = toTag('custom-button');
			const __$Button = __$literalMap.get(Button);
			const props = {
			  variant: 'primary',
			  size: 'large'
			};
			const template = htmlStatic\`<\${__$Button} \${__$rest(props)}>Submit</\${__$Button}>\`;
		`));
	});

	test('transforms element with mixed spread and regular attributes', ({ expect }) => {
		const source = `
		const props = { class: 'base' };
		const template = <div id="specific" {...props} data-test="value">Content</div>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t, __$rest } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<div id="specific" data-test="value">Content</div>\`,
			  "parts": [{
			    "type": 6,
			    "index": 0
			  }]
			};
			const props = {
			  class: 'base'
			};
			const template = {
			  "_$litType$": _temp,
			  "values": [__$rest(props)]
			};
		`));
	});

	// ========== NESTING & COMBINATION TESTS ==========

	test('transforms nested elements', ({ expect }) => {
		const source = `
		const template = (
			<div>
				<header>
					<h1>Title</h1>
				</header>
				<main>
					<p>Content</p>
				</main>
			</div>
		);
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<div><header><h1>Title</h1></header><main><p>Content</p></main></div>\`,
			  "parts": []
			};
			const template = {
			  "_$litType$": _temp,
			  "values": []
			};
		`));
	});

	test('transforms compiled template with standard template child', ({ expect }) => {
		const source = `
		const Element = toTag('custom-element');
		const template = (
			<div>
				<Element>Nested content</Element>
			</div>
		);
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { html as htmlStatic } from "lit-html/static.js";
			import { __$literalMap } from "@arcmantle/lit-jsx";
			const Element = toTag('custom-element');
			const __$Element = __$literalMap.get(Element);
			const template = htmlStatic\`<div><\${__$Element}>Nested content</\${__$Element}></div>\`;
		`));
	});

	test('transforms standard template with compiled template child', ({ expect }) => {
		const source = `
		const Element = toTag('custom-element');
		const template = (
			<Element>
				<div>Regular content</div>
			</Element>
		);
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { html as htmlStatic } from "lit-html/static.js";
			import { __$literalMap } from "@arcmantle/lit-jsx";
			const Element = toTag('custom-element');
			const __$Element = __$literalMap.get(Element);
			const template = htmlStatic\`<\${__$Element}><div>Regular content</\${__$Element}></\${__$Element}>\`;
		`));
	});

	test('transforms fragment with mixed content types', ({ expect }) => {
		const source = `
		const Element = toTag('custom-element');
		const template = (
			<>
				<div>Compiled content</div>
				<Element>Standard content</Element>
				<MyComponent>Function component</MyComponent>
			</>
		);
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { html as htmlStatic } from "lit-html/static.js";
			import { __$literalMap } from "@arcmantle/lit-jsx";
			const Element = toTag('custom-element');
			const __$Element = __$literalMap.get(Element);
			const template = htmlStatic\`<div>Compiled content</div><\${__$Element}>Standard content</\${__$Element}>\${MyComponent({
			  children: "Function component"
			})}\`;
		`));
	});

	test('transforms deeply nested mixed templates', ({ expect }) => {
		const source = `
		import { toTag } from "@arcmantle/lit-jsx";

		const Icon = function() {};
		const Card = toTag('ui-card');
		const Button = toTag('ui-button');
		const template = (
			<div class="container">
				<Card title="Card Title">
					<div class="content">
						<p>Some text content</p>
						<Button variant="primary">
							<Icon name="save" />
							Save
						</Button>
					</div>
				</Card>
			</div>
		);
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { html as htmlStatic } from "lit-html/static.js";
			import { toTag, __$literalMap } from "@arcmantle/lit-jsx";
			const Icon = function () {};
			const Card = toTag('ui-card');
			const __$Card = __$literalMap.get(Card);
			const Button = toTag('ui-button');
			const __$Button = __$literalMap.get(Button);
			const template = htmlStatic\`<div class="container"><\${__$Card} title="Card Title"><div class="content"><p>Some text content</\${__$Card}><\${__$Button} variant="primary">\${Icon({
			  name: "save"
			})}Save</\${__$Button}></\${__$Card}></\${__$Card}></div>\`;
		`));
	});

	// ========== EDGE CASES & SPECIAL SCENARIOS ==========

	test('transforms element with only whitespace content', ({ expect }) => {
		const source = `
		const template = <div>   </div>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<div></div>\`,
			  "parts": []
			};
			const template = {
			  "_$litType$": _temp,
			  "values": []
			};
		`));
	});

	test('transforms element with mixed text and expressions', ({ expect }) => {
		const source = `
		const name = 'John';
		const age = 30;
		const template = <div>Hello {name}, you are {age} years old!</div>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<div>Hello<?>, you are<?>years old!</div>\`,
			  "parts": [{
			    "type": 2,
			    "index": 1
			  }, {
			    "type": 2,
			    "index": 1
			  }]
			};
			const name = 'John';
			const age = 30;
			const template = {
			  "_$litType$": _temp,
			  "values": [name, age]
			};
		`));
	});

	test('transforms element with complex nested expressions', ({ expect }) => {
		const source = `
		const user = { profile: { name: 'John' } };
		const template = <div>Welcome, {user.profile?.name || 'Guest'}!</div>;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<div>Welcome,<?>!</div>\`,
			  "parts": [{
			    "type": 2,
			    "index": 1
			  }]
			};
			const user = {
			  profile: {
			    name: 'John'
			  }
			};
			const template = {
			  "_$litType$": _temp,
			  "values": [user.profile?.name || 'Guest']
			};
		`));
	});

	test('transforms element with function call expressions', ({ expect }) => {
		const source = `
		const template = (
			<div>
				<span>{formatDate(new Date())}</span>
				<span>{calculateTotal(items)}</span>
			</div>
		);
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<div><span><?></span><span><?></span></div>\`,
			  "parts": [{
			    "type": 2,
			    "index": 2
			  }, {
			    "type": 2,
			    "index": 3
			  }]
			};
			const template = {
			  "_$litType$": _temp,
			  "values": [formatDate(new Date()), calculateTotal(items)]
			};
		`));
	});

	test('transforms fragment as root element', ({ expect }) => {
		const source = `
		const template = (
			<>
				<div>First</div>
				<div>Second</div>
			</>
		);
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<div>First</div><div>Second</div>\`,
			  "parts": []
			};
			const template = {
			  "_$litType$": _temp,
			  "values": []
			};
		`));
	});

	test('transforms element with boolean attribute shorthand', ({ expect }) => {
		const source = `
		const template = <input type="checkbox" checked />;
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { __$t } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<input type="checkbox" checked></input>\`,
			  "parts": []
			};
			const template = {
			  "_$litType$": _temp,
			  "values": []
			};
		`));
	});

	// ========== COMPLEX REAL-WORLD SCENARIOS ==========

	test('transforms form with mixed template types', ({ expect }) => {
		const source = `
		const FormField = toTag('form-field');
		const Button = toTag('custom-button');
		const isSubmitting = false;
		const template = (
			<form onSubmit={handleSubmit}>
				<FormField label="Username" required>
					<input
						type="text"
						value={formData.username}
						onChange={handleChange}
						disabled={bool => isSubmitting}
					/>
				</FormField>
				<FormField label="Email">
					<input
						type="email"
						value={formData.email}
						onChange={handleChange}
					/>
				</FormField>
				<div class="form-actions">
					<Button
						type="submit"
						variant="primary"
						disabled={bool => isSubmitting}
						directive={[loading(isSubmitting)]}
					>
						{isSubmitting ? 'Submitting...' : 'Submit'}
					</Button>
					<ValidationMessages errors={errors} />
				</div>
			</form>
		);
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { html as htmlStatic } from "lit-html/static.js";
			import { __$literalMap } from "@arcmantle/lit-jsx";
			const FormField = toTag('form-field');
			const __$FormField = __$literalMap.get(FormField);
			const Button = toTag('custom-button');
			const __$Button = __$literalMap.get(Button);
			const isSubmitting = false;
			const template = htmlStatic\`<form onSubmit=\${handleSubmit}><\${__$FormField} label="Username" required><input type="text" value=\${formData.username} onChange=\${handleChange} ?disabled=\${isSubmitting}></\${__$FormField}></\${__$FormField}><\${__$FormField} label="Email"><input type="email" value=\${formData.email} onChange=\${handleChange}></\${__$FormField}></\${__$FormField}><div class="form-actions"><\${__$Button} type="submit" variant="primary" ?disabled=\${isSubmitting} \${loading(isSubmitting)}>\${isSubmitting ? 'Submitting...' : 'Submit'}</\${__$Button}>\${ValidationMessages({
			  errors: errors
			})}</div></form>\`;
		`));
	});

	test('transforms data table with dynamic content', ({ expect }) => {
		const source = `
		const TableRow = toTag('table-row');
		const TableCell = toTag('table-cell');
		const template = (
			<div class="table-container">
				<table>
					<thead>
						<tr>
							<th>Name</th>
							<th>Age</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{users.map(user => (
							<TableRow key={user.id}>
								<TableCell>{user.name}</TableCell>
								<TableCell>{user.age}</TableCell>
								<TableCell>
									<ActionButton
										onClick={prop => () => editUser(user.id)}
										icon="edit"
									/>
									<ActionButton
										onClick={prop => () => deleteUser(user.id)}
										icon="delete"
										variant="danger"
									/>
								</TableCell>
							</TableRow>
						))}
					</tbody>
				</table>
			</div>
		);
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { html as htmlStatic } from "lit-html/static.js";
			import { __$t, __$literalMap } from "@arcmantle/lit-jsx";
			const _temp = {
			  "h": __$t\`<div class="table-container"><table><thead><tr><th>Name</th><th>Age</th><th>Actions</th></tr></thead><tbody><?></tbody></table></div>\`,
			  "parts": [{
			    "type": 2,
			    "index": 8
			  }]
			};
			const TableRow = toTag('table-row');
			const __$TableRow = __$literalMap.get(TableRow);
			const TableCell = toTag('table-cell');
			const __$TableCell = __$literalMap.get(TableCell);
			const template = {
			  "_$litType$": _temp,
			  "values": [users.map(user => {
			    return htmlStatic\`<\${__$TableRow} key=\${user.id}><\${__$TableCell}>\${user.name}</\${__$TableCell}><\${__$TableCell}>\${user.age}</\${__$TableCell}><\${__$TableCell}>\${ActionButton({
			      onClick: prop => () => editUser(user.id),
			      icon: "edit"
			    })}\${ActionButton({
			      onClick: prop => () => deleteUser(user.id),
			      icon: "delete",
			      variant: "danger"
			    })}</\${__$TableCell}></\${__$TableRow}>\`;
			  })]
			};
		`));
	});

	test('transforms dashboard layout with components and templates', ({ expect }) => {
		const source = `
		const Card = toTag('ui-card');
		const Grid = toTag('ui-grid');
		const Sidebar = toTag('ui-sidebar');
		const template = (
			<div class="dashboard">
				<header class="dashboard-header">
					<h1>Dashboard</h1>
					<UserMenu user={currentUser} />
				</header>
				<div class="dashboard-body">
					<Sidebar position="left">
						<NavigationMenu items={menuItems} />
					</Sidebar>
					<main class="dashboard-content">
						<Grid cols="2" gap="large">
							<Card title="Statistics" span="2">
								<StatsChart
									data={chartData}
									type="line"
									directive={[resize()]}
								/>
							</Card>
							<Card title="Recent Activity">
								<ActivityFeed
									items={activities}
									maxItems={10}
								/>
							</Card>
							<Card title="Quick Actions">
								<div class="action-grid">
									{quickActions.map(action => (
										<ActionCard
											key={action.id}
											title={action.title}
											icon={action.icon}
											onClick={action.handler}
											disabled={bool => action.disabled}
										/>
									))}
								</div>
							</Card>
						</Grid>
					</main>
				</div>
			</div>
		);
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { html as htmlStatic } from "lit-html/static.js";
			import { __$literalMap } from "@arcmantle/lit-jsx";
			const Card = toTag('ui-card');
			const __$Card = __$literalMap.get(Card);
			const Grid = toTag('ui-grid');
			const __$Grid = __$literalMap.get(Grid);
			const Sidebar = toTag('ui-sidebar');
			const __$Sidebar = __$literalMap.get(Sidebar);
			const template = htmlStatic\`<div class="dashboard"><header class="dashboard-header"><h1>Dashboard</h1>\${UserMenu({
			  user: currentUser
			})}</header><div class="dashboard-body"><\${__$Sidebar} position="left">\${NavigationMenu({
			  items: menuItems
			})}</\${__$Sidebar}><main class="dashboard-content"><\${__$Grid} cols="2" gap="large"><\${__$Card} title="Statistics" span="2">\${StatsChart({
			  data: chartData,
			  type: "line",
			  directive: [resize()]
			})}</\${__$Card}><\${__$Card} title="Recent Activity">\${ActivityFeed({
			  items: activities,
			  maxItems: 10
			})}</\${__$Card}><\${__$Card} title="Quick Actions"><div class="action-grid">\${quickActions.map(action => {
			  return ActionCard({
			    key: action.id,
			    title: action.title,
			    icon: action.icon,
			    onClick: action.handler,
			    disabled: bool => action.disabled
			  });
			})}</\${__$Card}></\${__$Card}></\${__$Grid}></main></div></div>\`;
		`));
	});

	test('transforms modal with portal and dynamic content', ({ expect }) => {
		const source = `
		const Modal = toTag('ui-modal');
		const Portal = toTag('ui-portal');
		const Button = toTag('ui-button');
		const template = (
			<Portal target="body">
				<Modal
					open={bool => isOpen}
					onClose={handleClose}
					directive={[
						trapFocus(),
						preventScroll(),
						clickOutside(handleClose)
					]}
				>
					<div class="modal-header">
						<h2>{title}</h2>
						<Button
							variant="ghost"
							size="small"
							onClick={handleClose}
							aria-label="Close"
						>
							<CloseIcon />
						</Button>
					</div>
					<div class="modal-body">
						{content || (
							<DefaultContent
								type={contentType}
								data={contentData}
							/>
						)}
					</div>
					<div class="modal-footer">
						{actions.map(action => (
							<Button
								key={action.id}
								variant={action.variant || 'secondary'}
								onClick={action.handler}
								disabled={bool => action.disabled}
							>
								{action.label}
							</Button>
						))}
					</div>
				</Modal>
			</Portal>
		);
		`;

		const code = babel.transformSync(source, getOpts())?.code;

		expect(code).toBe(dedent(`
			import { html as htmlStatic } from "lit-html/static.js";
			import { __$literalMap } from "@arcmantle/lit-jsx";
			const Modal = toTag('ui-modal');
			const __$Modal = __$literalMap.get(Modal);
			const Portal = toTag('ui-portal');
			const __$Portal = __$literalMap.get(Portal);
			const Button = toTag('ui-button');
			const __$Button = __$literalMap.get(Button);
			const template = htmlStatic\`<\${__$Portal} target="body"><\${__$Modal} ?open=\${isOpen} onClose=\${handleClose} \${trapFocus()} \${preventScroll()} \${clickOutside(handleClose)}><div class="modal-header"><h2>\${title}</\${__$Modal}><\${__$Button} variant="ghost" size="small" onClick=\${handleClose} aria-label="Close">\${CloseIcon({})}</\${__$Button}></\${__$Modal}><div class="modal-body">\${content || DefaultContent({
			  type: contentType,
			  data: contentData
			})}</\${__$Modal}><div class="modal-footer">\${actions.map(action => {
			  return htmlStatic\`<\${__$Button} key=\${action.id} variant=\${action.variant || 'secondary'} onClick=\${action.handler} ?disabled=\${action.disabled}>\${action.label}</\${__$Button}>\`;
			})}</\${__$Modal}></\${__$Modal}></\${__$Portal}>\`;
		`));
	});
});
