export {};


/**
 * TSX hook declarations for lit-jsx.
 */

declare global {
	//#region JSX hooks (TypeScript special names)
	// These names are *looked up by TypeScript* when type-checking TSX.
	namespace JSX {
		/**
		 * TSX hook: the type produced by any JSX expression.
		 *
		 * In lit-jsx we return a lit `TemplateResult`, so `<div />` has this type.
		 */
		type Element = LitJSX.Element;

		/**
		 * TSX hook: what values are allowed as JSX tags.
		 *
		 * Note: this intentionally references tag/component helper types declared in
		 * `jsx-core.ts`.
		 */
		type ElementType
			= keyof LitJSX.IntrinsicElements
			| (string & {})
			| LitJSX.ComponentLike<any>;

		/**
		 * TSX hook: computes the attribute (props) type for a JSX tag.
		 *
		 * lit-jsx uses this to:
		 * - require `static: true` for class-based component tags
		 * - preserve TSX generic arguments on class instances (avoid `unknown` props)
		 */
		type LibraryManagedAttributes<C, P>
			= C extends abstract new (...args: any[]) => infer I
				? (P extends I
					? LitJSX.JSXProps<Extract<P, object>> & LitJSX.StaticMarker
					: LitJSX.ComponentProps<C> & LitJSX.StaticMarker)
				: (C extends keyof LitJSX.IntrinsicElements
					? LitJSX.IntrinsicElementProps<C>
					: LitJSX.ComponentProps<C>);

		/**
		 * TSX hook: controls the instance type used for class components.
		 *
		 * We keep this empty because we don’t require any particular base class.
		 */
		interface ElementClass {}

		/**
		 * TSX hook: which property name TypeScript should read for “props”.
		 *
		 * Leaving it empty means TS uses its default behavior.
		 */
		interface ElementAttributesProperty {}

		/**
		 * TSX hook: which property name represents “children”.
		 */
		interface ElementChildrenAttribute { children: {}; }

		/** TSX hook: attributes allowed on *all* JSX elements (e.g. React's `key`). */
		interface IntrinsicAttributes {}

		/** TSX hook: attributes allowed on class components specifically (often `ref`-like). */
		interface IntrinsicClassAttributes<_T> {}

		/** TSX hook: base attribute bag TypeScript may intersect into component props. */
		interface Attributes {}

		/** TSX hook: fragment typing for `<>...</>` */
		type Fragment = Element;

		/**
		 * TSX hook: mapping of intrinsic tag names to their attribute types.
		 *
		 * Note: this intentionally depends on DOM typings declared in `jsx-dom.ts`
		 * (e.g. `HTMLElementTags`, `SVGElementTags`, ...).
		 */
		interface IntrinsicElements extends LitJSX.IntrinsicElements {}
	}
	//#endregion
}
