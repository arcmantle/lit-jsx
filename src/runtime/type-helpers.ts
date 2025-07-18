/**
 * Creates a component that can be used directly in JSX syntax.
 * Also registers the custom element if it hasn't been registered yet.
 *
 * @example
 * ```tsx
 * import { toComponent } from 'jsx-lit';
 *
 * export class MyButton extends LitElement {
 *   static tagName = 'my-button';
 * }
 *
 * const MyButtonComponent = toComponent(MyButton);
 *
 * // Usage in JSX - compiler automatically detects this as a custom element
 * const jsx = (
 *   <MyButtonComponent
 *     class="my-button"
 *     on-click={() => { console.log('Clicked!'); }}
 *   />
 * );
 * ```
 */
export const toComponent = <T extends { new(...args: any): any; tagName: string; }>(
	element: T,
): ToComponent<InstanceType<T>> => {
	if (!element.tagName)
		throw new Error('Element must have a static tagName property');

	if ('register' in element && typeof element.register === 'function')
		element.register();
	else if (!customElements.get(element.tagName))
		customElements.define(element.tagName, element);

	return element.tagName as any;
};

export type ToComponent<T extends object = object> = (props: JSX.JSXProps<T>) => string;


/**
 * Creates a dynamic tag that can be used directly in JSX syntax.
 * The compiler automatically detects when this helper is used and compiles
 * it to efficient static lit-html templates.
 *
 * @example
 * ```tsx
 * import { toTag } from 'jsx-lit';
 *
 * // Creates a dynamic tag that the compiler will recognize
 * const DynamicDiv = toTag('div');
 * const DynamicCustomElement = toTag('my-custom-element');
 *
 * // Usage in JSX - compiler automatically handles the transformation
 * function renderConditional({ useDiv }) {
 *   const Tag = toTag(useDiv ? 'div' : 'span');
 *   return <Tag class="dynamic">Content</Tag>;
 * }
 *
 * // Compiles to efficient static templates automatically:
 * // const Tag = toTag(useDiv ? 'div' : 'span');
 * // const __$Tag = __$literalMap.get(Tag);
 * // htmlStatic`<${__$Tag} class="dynamic">Content</${__$Tag}>`
 * ```
 *
 * @example
 * ```tsx
 * // ❌ Without toTag helper - won't compile to static templates
 * const BadTag = 'div';
 * return <BadTag>Content</BadTag>; // This won't work with jsx-lit
 *
 * // ✅ With toTag helper - compiler automatically optimizes
 * const GoodTag = toTag('div');
 * return <GoodTag>Content</GoodTag>; // Compiles to static templates
 * ```
 *
 * @param tag - The HTML tag name (standard HTML elements or custom element names)
 * @returns A tag identifier that the compiler recognizes for optimization
 */
export const toTag = <T extends keyof HTMLElementTagNameMap | (string & {})>(
	tag: T,
): T => tag;


export type ToTag<T extends keyof HTMLElementTagNameMap | (string & {}) = string> = T;
