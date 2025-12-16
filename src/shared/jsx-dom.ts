import type * as csstype from 'csstype';


declare global {
	namespace LitJSX {

		interface CSSProperties extends csstype.Properties { }

		/**
		 * Interface for native HTML elements
		 */
		type NativeHTMLElements = ElementMapToJSXElements<HTMLElementTagNameMap>;

		/**
		 * Interface for native SVG elements
		 */
		type NativeSVGElements = ElementMapToJSXElements<Omit<SVGElementTagNameMap, keyof HTMLElementTagNameMap>>;

		/**
		 * Interface for native MathML elements
		 */
		type NativeMathMLElements = ElementMapToJSXElements<Omit<MathMLElementTagNameMap, keyof HTMLElementTagNameMap>>;

		/**
		 * Interface for semantic tags that start with "s-".
		 */
		interface SemanticTags { [key: `s-${ string }`]: JSXElementProps<HTMLElement>; }
	}
}
