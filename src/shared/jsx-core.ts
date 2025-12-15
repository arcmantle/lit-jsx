import type { nothing, TemplateResult } from 'lit-html';
import type { DirectiveResult } from 'lit-html/async-directive.js';


/**
 * Core (non-DOM) JSX typing surface for lit-jsx.
 *
 * - `jsx-core.ts` owns: component/class support, `static` marker, dynamic tag typing
 *   (`as.tag`), and shared helper types used by DOM typings.
 * - `jsx-dom.ts` owns: DOM attributes and events.
 * - `jsx-hooks.ts` owns: TSX hook names (`JSX.Element`, `JSX.ElementType`, ...).
 */


declare global {
	namespace LitJSX {
		//#region Shared primitives (used by jsx-dom.ts)

		type DOMElement = Element;

		type IfEquals<X, Y, A = X> =
		(<T>() => T extends X ? 1 : 2) extends
		(<T>() => T extends Y ? 1 : 2) ? A : never;
		type WritableKeys<T> = {
			[P in keyof T]-?: IfEquals<{ [Q in P]: T[P] }, { -readonly [Q in P]: T[P] }, P>
		}[keyof T];
		type TrimReadonly<T> = Pick<T, WritableKeys<T>>;
		type ExcludeHTML<T extends object> = TrimReadonly<Omit<T, keyof HTMLElement | 'constructor'>>;

		type Child = [
			Generator,
			DirectiveResult<any>,
			typeof nothing,
			TemplateResult<any>,
			Node,
			Child[],
			(string & {}),
			number,
			boolean,
			null,
			undefined,
			unknown,
		][number];
		//#endregion

		// NOTE: TSX hook names (like `JSX.Element`) are declared in `jsx-hooks.ts`.

		//#region Component model (functions, classes, dynamic tags)

		type Element = TemplateResult<any>;

		/**
		 * A "functional component" in this ecosystem.
		 * Your transpiler can rewrite calls however it wants; this is just for TS type-checking.
		 */
		type Component<P extends object = {}> = (props: P) => Element;
		//#endregion

		/**
		 * A component-like value representing a dynamic intrinsic tag.
		 *
		 * Usage (type-only):
		 *   const Tag = as.tag('a');
		 *   <Tag static href="..." />
		 */
		//#region Dynamic tag support (`as.tag`)

		/**
		 * Tag-name helpers.
		 *
		 * Motivation: we want `as.tag()` to accept any string tag name, but we don't
		 * want the type parameter to collapse to plain `string`, because that would
		 * prevent TS from preserving literals like `'a'` and `'es-button'`.
		 */
		type AnyTagName = string & Record<never, never>;
		interface IntrinsicElements extends
			LitJSX.HTMLElementTags,
			LitJSX.HTMLElementDeprecatedTags,
			LitJSX.SVGElementTags,
			LitJSX.SemanticTags,
			LitJSX.CustomElementTags {}
		type IntrinsicTagName = keyof IntrinsicElements;
		type DeclaredCustomElementTagName = keyof HTMLElementTagNameMap;
		type KnownTagName = IntrinsicTagName | DeclaredCustomElementTagName;
		type TagName = KnownTagName | AnyTagName;

		type DynamicTagProps<Tag extends string> =
			Tag extends keyof IntrinsicElements
				? IntrinsicElements[Tag]
				: (
					Tag extends keyof HTMLElementTagNameMap
						? HTMLAttributes<HTMLElementTagNameMap[Tag]> & Record<string, unknown>
						: HTMLAttributes<HTMLElement> & Record<string, unknown>
				);

		type ConstructorInstance<C> = C extends abstract new (...args: any[]) => infer I ? I : never;
		type IntrinsicElementProps<Tag extends IntrinsicTagName> = IntrinsicElements[Tag];

		type DynamicTag<Tag extends TagName> =
			((props: DynamicTagProps<Tag> & StaticMarker) => Element)
			& { readonly __tag: Tag; };
		//#endregion

		//#region Compiler markers

		/**
		 * `static` is a special attribute used by the compiler to decide whether a
		 * component renders as a custom element.
		 */
		interface StaticMarker {
			/**
			 * Opt into the lit-jsx custom-element transform.
			 * Example: `<MyElement static />`
			 */
			static: true;
		}
		//#endregion

		/**
		 * Permissive marker for "class identifiers used as JSX components".
		 *
		 * Why: TS normally treats `class Foo extends HTMLElement {}` as a constructor value, which is not
		 * callable. If your JSX transform rewrites `<Foo />` into something else, you may still want TS to
		 * accept `Foo` in component position.
		 *
		 * This makes *any* `new (...args) => any` acceptable as a component value for typing purposes.
		 */
		/**
		 * A constructable value that can appear in JSX component position.
		 *
		 * Important: this is intentionally generic so TS can apply TSX type
		 * arguments, e.g. `<MyElement<string> />`.
		 */
		type ClassComponent<Instance extends object = any> = abstract new (...args: any[]) => Instance;

		/**
		 * A value that can appear as `<X ... />`.
		 *
		 * - Functions model normal functional components.
		 * - Classes (including `class Foo extends HTMLElement`) are allowed because
		 *   many transforms rewrite them; for type-checking, props can be provided
		 *   via the `__jsxProps` marker.
		 */
		type ComponentLike<P extends object = object> =
			| Component<P>
			| ClassComponent<any>;

		type IntrinsicTagLiteral = IntrinsicTagName & (string & {});

		//#region Attribute/prop inference helpers

		type ComponentProps<T> =
			T extends Component<infer P> ? P :
				T extends ClassComponent<infer I> ? JSXProps<Extract<I, object>> :
					T extends abstract new (...args: any[]) => infer I ? JSXProps<Extract<I, object>> :
						{};
		//#endregion

		//#region Shared helpers used across DOM attributes

		type CanBeNothingValue<V> =
			| V
			| typeof nothing;
		type CanBeNothing<T extends object> = {
			[K in keyof T]?: CanBeNothingValue<T[K]>;
		};

		/**
		 * Props for a component instance.
		 *
		 * Note: we intentionally avoid letting `HTMLAttributes<T>` override keys that
		 * already exist on the instance props (e.g. a custom element field named
		 * `value`). If we don't, intersections like `value: T | null` with
		 * `value?: unknown` will degrade IntelliSense to `unknown`.
		 */
		type JSXProps<T extends object> =
			& CanBeNothing<ExcludeHTML<T>>
			& Omit<HTMLAttributes<T>, keyof ExcludeHTML<T>>
			& {};
		//#endregion
	}

	//#region Global compiler helpers
	// This is a type-only API surface: the compiler strips these calls at build time.

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
	//#endregion
}
