import type { DirectiveResult } from 'lit-html/async-directive.js';
import type { RefOrCallback } from 'lit-html/directives/ref.js';


declare const explicitSymbol: unique symbol;


declare global {
	namespace LitJSX {
		interface ExplicitBrand { [explicitSymbol]?: never; }

		/**
		 * Marks a type as explicitly required when used in JSX props. \
		 * This allows making certain props required, while keeping the rest optional.
		 *
		 * Example:
		 * ```
		 * class MyElement extends LitElement {
		 *    name: LitJSX.Explicit<string>;
		 *    size: number;
		 * }
		 *	```
		 * In this example, `name` is required while `size` is optional.
		 */
		type Explicit<T> = T & ExplicitBrand;

		type IsMandatory<T> = T extends { [explicitSymbol]?: never; }
			? (typeof explicitSymbol extends keyof T ? true : false)
			: false;
		type UnwrapMandatory<T> = T extends Explicit<infer U> ? U : T;
		type PartialExceptRequired<T extends object> = {
			[P in keyof T as IsMandatory<T[P]> extends true ? P : never]: UnwrapMandatory<T[P]>
		} & {
			[P in keyof T as IsMandatory<T[P]> extends true ? never : P]?: T[P]
		};

		type IfEquals<X, Y, A = X> =
			(<T>() => T extends X ? 1 : 2) extends
			(<T>() => T extends Y ? 1 : 2) ? A : never;

		type WritableKeys<T> = {
			[P in keyof T]-?: IfEquals<
				{ [Q in P]: T[P] },
				{ -readonly [Q in P]: T[P] },
				P
			>
		}[keyof T];

		type TrimReadonly<T> = Pick<T, WritableKeys<T>>;

		interface DataProps {
			[key: `data-${ string }`]: string | undefined;
		}

		type SpecialProps<T extends object = object> = Omit<T, 'style' | 'styleList' | 'class' | 'classList'> & {
			/**
			 * Opt into the lit-jsx custom-element transform.
			 *
			 * Example: `<MyElement static />`
			 *
			 * This is only required when not using type-inference option.
			 * or using javascript without type checking.
			 */
			static?: true;

			/**
			 * The children of this JSX element.
			 *
			 * Example: `<div>Children here</div>` \
			 * Example with expression: `<div>{someValue}</div>`
			 *
			 * This property should generally not be set directly, but rather via
			 * the content between the opening and closing tags of the JSX element.
			 */
			children?: LitJSX.Child;

			/**
			 * A reference to the underlying element.
			 *
			 * Example: `<div ref={myRef}></div>` \
			 * Example with callback: `<div ref={(el) => { ... }}></div>`
			 */
			ref?: RefOrCallback<PartialExceptRequired<TrimReadonly<T>>>;

			/**
			 * An object defining CSS classes.
			 *
			 * Example: `<div classList={{ myClass: true, anotherClass: false }}></div>`
			 */
			classList?: { [k: string]: boolean | undefined; };

			/**
			 * An object defining CSS properties.
			 *
			 * Example: `<div styleList={{ color: 'red', fontSize: '16px' }}></div>`
			 */
			styleList?: CSSProperties;

			/**
			 * A string or object defining CSS classes or styles. \
			 * When a string is provided, it is set directly on the `class` or `style` attribute. \
			 * When an object is provided, its keys and values are set as CSS properties.
			 *
			 * Example 1: `<div class={{ myClass: true, anotherClass: false }}></div>` \
			 * Example 2: `<div class="my-class another-class"></div>`
			 */
			class?: { [k: string]: boolean | undefined; } | string;

			/**
			 * A string or object defining CSS styles. \
			 * When a string is provided, it is set directly on the `style` attribute. \
			 * When an object is provided, its keys and values are set as CSS properties.
			 *
			 * Example 1: `<div style={{ color: 'red', fontSize: '16px' }}></div>` \
			 * Example 2: `<div style="color: red; font-size: 16px;"></div>`
			 */
			style?: CSSProperties | string;

			/**
			 * This property takes in one or more element directives.
			 * This is akin to applying a directive through `<div ${myDirective()}></div>`.
			 */
			directive?: DirectiveResult<any> | DirectiveResult<any>[];
		} & DataProps;

		type JSXElementProps<T extends object> = SpecialProps<PartialExceptRequired<TrimReadonly<T>>>;

		type ElementMapToJSXElements<T extends Record<string, any>> = {
			[K in keyof T]: JSXElementProps<T[K]>;
		};

		type Child = unknown;
		type Element = unknown;

		type AnyTagName = string & Record<never, never>;

		interface IntrinsicElements extends
			NativeHTMLElements,
			NativeSVGElements,
			NativeMathMLElements,
			SemanticTags {}

		type TagName = keyof IntrinsicElements | AnyTagName;

		type DynamicTagProps<Tag extends string> = Tag extends keyof IntrinsicElements
			? IntrinsicElements[Tag]
			: (Tag extends keyof HTMLElementTagNameMap
				? JSXElementProps<HTMLElementTagNameMap[Tag]>
				: JSXElementProps<HTMLElement>);

		type DynamicTag<Tag extends TagName> = ((props: DynamicTagProps<Tag>) => Element);

		type Component<P extends object = {}> = (props: P) => Element;
		type ClassComponent<Instance extends object = any> = abstract new (...args: any[]) => Instance;
		type ComponentLike<P extends object = object> =
			| Component<P>
			| ClassComponent<any>;

		type ComponentProps<T> =
			T extends Component<infer P> ? P :
				T extends ClassComponent<infer I> ? JSXElementProps<Extract<I, object>> :
					T extends abstract new (...args: any[]) => infer I ? JSXElementProps<Extract<I, object>> :
						{};
	}

	// eslint-disable-next-line no-var
	var as: {
		/**
		 * Informs the compiler that the value should be bound as a property value.\
		 * This binds the expression value as a property, using the `.` syntax e.g `.key=${value}`\
		 * This function call is removed during compilation, therefore it has no runtime effect.
		 */
		prop: <T>(value: T) => T;
		/**
		 * Informs the compiler that the value should be bound as a boolean attribute.\
		 * This allows the template to bind the value using the `?` syntax, e.g. `?disabled=${true}`\
		 * This function call is removed during compilation, therefore it has no runtime effect.
		 */
		bool: (value: boolean) => boolean;
		/**
		 * Creates a component-like value for an intrinsic tag, so it can be used in
		 * JSX as a dynamic tag identifier.
		 *
		 * The returned component requires `static`.
		 * Example:
		 *   const Tag = as.tag('a');
		 *   <Tag static href="..." />
		 */
		tag:  <Tag extends LitJSX.TagName>(tag: Tag) => LitJSX.DynamicTag<Tag>;
	};
}
