import { when } from 'lit-html/directives/when.js';


/**
 * Conditionally renders content based on a truthy value.
 *
 * @template T - The type of the condition value
 * @template U - The JSX element type returned by the render functions
 * @param props.when - The condition value to evaluate for truthiness
 * @param props.children - A single render or tuple containing render functions for true and optionally false cases
 * @returns The rendered JSX element based on the condition's truthiness
 *
 * @example
 * ```tsx
 * <Show when={user}>
 *   {(user) => <div>Welcome, {user.name}!</div>}
 *   {() => <div>Please log in</div>}
 * </Show>
 *
 * // Or without fallback
 * <Show when={isVisible}>
 *   {() => <div>This content is visible</div>}
 * </Show>
 * ```
 */
export function Show<C>(props: {
	when:     C;
	children:
		| ((value: NoInfer<C>) => JSX.JSXElement)
		| [
			true: ((value: NoInfer<C>) => JSX.JSXElement),
			false: ((value: NoInfer<C>) => JSX.JSXElement),
		];
}): JSX.JSXElement {
	if (Array.isArray(props.children))
		return when(props.when, props.children[0], props.children[1]);

	return when(props.when, props.children);
}
