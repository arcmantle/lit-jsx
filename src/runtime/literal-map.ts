import type { StaticValue } from 'lit-html/static.js';
import { unsafeStatic } from 'lit-html/static.js';


/**
 * Cache for static literal values used in lit-html templates.
 * Extends Map to automatically create and cache StaticValue instances for string keys.
 */
class LiteralMap extends Map<string, StaticValue> {

	/**
	 * Gets a cached StaticValue for the given key, creating one if it doesn't exist.
	 *
	 * @param key - The string key to get or create a StaticValue for
	 * @returns The cached or newly created StaticValue
	 */
	override get(key: string): StaticValue {
		const value = super.get(key);
		if (value === undefined) {
			const literal = unsafeStatic(key);
			this.set(key, literal);

			return literal;
		}

		return value;
	}

}


/**
 * Global cache instance for static literal values used throughout jsx-lit templates.
 * This is used internally by the jsx-lit compiler to cache StaticValue instances
 * for efficient template reuse.
 */
export const __$literalMap: LiteralMap = new LiteralMap();
