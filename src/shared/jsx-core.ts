import type { DirectiveResult } from 'lit-html/async-directive.js';
import type { RefOrCallback } from 'lit-html/directives/ref.js';


declare global {
	namespace LitJSX {
		type HTMLElementAssignableProps<T extends object & Record<string, any>> =
			Partial<TrimReadonly<T>>;

		type HTMLElementProps = HTMLElementAssignableProps<HTMLElement>;

		type JSXElementProps<T extends object> = Omit<HTMLElementAssignableProps<T>, 'style'> & {
			children?:  LitJSX.Child;
			ref?:       RefOrCallback<HTMLElementAssignableProps<T>>;
			classList?: { [k: string]: boolean | undefined; };
			styleList?: CSSProperties;
			class?:     { [k: string]: boolean | undefined; } | string;
			style?:     CSSProperties | string;

			/**
			 * This property takes in one or more element directives.
			 * This is akin to applying a directive through `<div ${myDirective()}></div>`.
			 */
			directive?: DirectiveResult<any> | DirectiveResult<any>[];
		} & {
			[key: `data-${ string }`]: string | undefined;
		};

		type ElementMapToJSXElements<T extends object & Record<string, any>> = {
			[K in keyof T]: JSXElementProps<T[K]>;
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

		type TrimHTMLElement<T extends object> = TrimReadonly<Omit<T, keyof HTMLElement | 'constructor'>>;

		type JSXProps<T extends object> =
			& TrimHTMLElement<T>
			& Omit<HTMLElementProps, keyof TrimHTMLElement<T>>;

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

		type IntrinsicElementProps<Tag extends keyof IntrinsicElements> = IntrinsicElements[Tag];

		type DynamicTag<Tag extends TagName> = ((props: DynamicTagProps<Tag> & StaticMarker) => Element);

		interface StaticMarker {
			/**
			 * Opt into the lit-jsx custom-element transform. \
			 * Example: `<MyElement static />`
			 */
			static?: true;
		}

		type Component<P extends object = {}> = (props: P) => Element;
		type ClassComponent<Instance extends object = any> = abstract new (...args: any[]) => Instance;

		type ComponentLike<P extends object = object> =
			| Component<P>
			| ClassComponent<any>;

		type ComponentProps<T> =
			T extends Component<infer P> ? P :
				T extends ClassComponent<infer I> ? JSXProps<Extract<I, object>> :
					T extends abstract new (...args: any[]) => infer I ? JSXProps<Extract<I, object>> :
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
