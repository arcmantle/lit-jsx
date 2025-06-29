import type { ElementPart } from 'lit-html';
import { noChange } from 'lit-html';
import type { DirectiveParameters, DirectiveResult, PartInfo } from 'lit-html/directive.js';
import { Directive, directive, PartType } from 'lit-html/directive.js';


/**
 * Lit directive for applying rest/spread props to an element.
 * Efficiently sets properties and attributes from an object of key-value pairs.
 */
class RestDirective extends Directive {

	constructor(part: PartInfo) {
		super(part);

		if (part.type !== PartType.ELEMENT)
			throw new Error('RestDirective can only be used on ElementParts');
	}

	override update(part: ElementPart, [ rest ]: DirectiveParameters<this>): unknown {
		const element = part.element as HTMLElement & Record<string, any>;

		for (const key in rest) {
			if (!Object.prototype.hasOwnProperty.call(rest, key))
				continue;

			const value = rest[key]!;

			if (element[key] === value)
				continue;

			if (typeof value === 'object')
				element[key] = value;
			else if (value === null || value === undefined)
				element.removeAttribute(key);
			else
				element.setAttribute(key, String(value));
		}

		return noChange;
	}

	override render(rest: Record<keyof any, any>): unknown {
		console.log('rest parameter stuff', rest);

		return noChange;
	}

}


/**
 * Lit directive for applying rest/spread props to DOM elements.
 *
 * This directive efficiently applies an object of properties and attributes
 * to a DOM element, handling the differences between properties and attributes
 * automatically.
 *
 * @example
 * ```tsx
 * const props = { className: 'my-class', disabled: true };
 * <div {...__$rest(props)}>Content</div>
 * ```
 */
export const __$rest: DirectiveResult<typeof RestDirective> =
	directive(RestDirective);
