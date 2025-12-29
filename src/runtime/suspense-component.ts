import { until } from 'lit-html/directives/until.js';


/**
 * Renders fallback content while waiting for a promise to resolve, similar to React's Suspense.
 * Uses lit-html's until directive to handle asynchronous content.
 *
 * @template T - The type of the resolved promise value
 * @param props.promise - A promise that resolves to a value passed to the children render function
 * @param props.fallback - Optional fallback content to display while the promise is pending
 * @param props.children - Render function that receives the resolved promise value
 * @returns The rendered JSX element, showing fallback until the promise resolves
 *
 * @example
 * ```tsx
 * <Suspense
 *   promise={fetchUser()}
 *   fallback={<div>Loading user...</div>}
 * >
 *   {(user) => <div>Welcome, {user.name}!</div>}
 * </Suspense>
 *
 * // Without fallback (nothing renders until promise resolves)
 * <Suspense promise={fetchData()}>
 *   {(data) => <div>{data.content}</div>}
 * </Suspense>
 * ```
 */
export function Suspense<T>(props: {
	promise:   Promise<T>;
	fallback?: LitJSX.Child;
	children:  (value: T) => LitJSX.Child;
}): LitJSX.Child {
	return until(
		props.promise.then(value => props.children(value)),
		props.fallback,
	);
}
