import type { BabelFile, PluginPass } from '@babel/core';


export type BabelPlugins = NonNullable<NonNullable<babel.TransformOptions['parserOpts']>['plugins']>;


export const babelPlugins: Set<BabelPlugins[number]> = new Set([
	'jsx',
	'typescript',
	'decorators',
	'decoratorAutoAccessors',
]);
export const debugMode = { value: false };

export const CE_ATTR_IDENTIFIER = 'static';
export const COMPONENT_LITERAL_PREFIX = '__$';
export const WHITESPACE_TAGS: string[] = [ 'pre', 'textarea' ];
export const SPECIAL_TAGS: string[] = [];
export const ATTR_NAMES = {
	REF:          'ref',
	CLASS_LIST:   'classList',
	STYLE_LIST:   'styleList',
	DIRECTIVE:    'directive',
	EVENT_PREFIX: 'on',
} as const;
export const ATTR_BIND_OBJ_NAME = 'as';
export const ATTR_VALUES = {
	BOOL: 'bool',
	PROP:	'prop',
} as const;
export const VARIABLES = {
	HTML:                'html',
	HTML_LOCAL:          '__$html',
	HTML_STATIC:         'htmlStatic',
	HTML_STATIC_LOCAL:   '__$htmlStatic',
	SVG:                 'svg',
	SVG_LOCAL:           '__$svg',
	SVG_STATIC:          'svgStatic',
	SVG_STATIC_LOCAL:    '__$svgStatic',
	MATHML:              'mathml',
	MATHML_LOCAL:        '__$mathml',
	MATHML_STATIC:       'mathmlStatic',
	MATHML_STATIC_LOCAL: '__$mathmlStatic',
	UNSAFE_STATIC:       'unsafeStatic',
	UNSAFE_STATIC_LOCAL: '__$unsafeStatic',
	CLASS_MAP:           'classMap',
	CLASS_MAP_LOCAL:     '__$classMap',
	STYLE_MAP:           'styleMap',
	STYLE_MAP_LOCAL:     '__$styleMap',
	REF:                 'ref',
	REF_LOCAL:           '__$ref',
	REST:                '__$rest',
	LITERAL_MAP:         '__$literalMap',
	T_TEMPLATE_UTIL:     '__$t',
	BOOLEAN_PART:        'BooleanPart',
	ATTRIBUTE_PART:      'AttributePart',
	PROPERTY_PART:       'PropertyPart',
	ELEMENT_PART:        'ElementPart',
	EVENT_PART:          'EventPart',
	CHILD_PART:          'ChildPart',
} as const;
export const SOURCES = {
	HTML:          '@arcmantle/lit-jsx',
	HTML_STATIC:   '@arcmantle/lit-jsx',
	SVG:           '@arcmantle/lit-jsx',
	SVG_STATIC:    '@arcmantle/lit-jsx',
	MATHML:        '@arcmantle/lit-jsx',
	MATHML_STATIC: '@arcmantle/lit-jsx',
	UNSAFE_STATIC: '@arcmantle/lit-jsx',
	REF:           '@arcmantle/lit-jsx',
	CLASS_MAP:     '@arcmantle/lit-jsx',
	STYLE_MAP:     '@arcmantle/lit-jsx',
	REST:          '@arcmantle/lit-jsx',
	LITERAL_MAP:   '@arcmantle/lit-jsx',
	JSX_LIT:       '@arcmantle/lit-jsx',
} as const;
export const ERROR_MESSAGES = {
	INVALID_INITIAL_ELEMENT:    'Invalid initial element found. The first element must be a JSX element.',
	NO_PROGRAM_FOUND:           'No program found for JSX transformation.',
	INVALID_OPENING_TAG:        'Invalid opening tag found.',
	EMPTY_JSX_EXPRESSION:       'Empty JSX expression found.',
	ONLY_STRING_LITERALS:       'Only string literals are supported for JSX attributes.',
	INVALID_DIRECTIVE_VALUE:    'Invalid value in directive expression.',
	UNKNOWN_JSX_ATTRIBUTE_TYPE: 'Unknown JSX attribute type found.',
	IDENTIFIER_NOT_FOUND:       (name: string): string => `Identifier '${ name }' not found in any accessible scope`,
	TAG_NAME_NOT_FOUND:         (tagName: string): string => `Tag name '${ tagName }' not found in any accessible scope`,
	NO_STATEMENT_PATH:          (tagName: string): string => `Could not find statement-level path for tagName: ${ tagName }`,
	UNKNOWN_TEMPLATE_TYPE:      (type: string): string => `Unknown template type: ${ type }`,
	INVALID_BIND_TYPE:          (type: string): string => `Invalid bind type: ${ type }`,
	BODY_NOT_BLOCK:             (tagName: string): string => `The body of the function returning '${ tagName }' `
		+ `must be a block statement.`,
} as const;


interface PluginOptions {
	useCompiledTemplates?: boolean;
	useImportDiscovery?:   boolean;
}


export const initializePluginOptions = (file: BabelFile): { useCompiledTemplates?: boolean; } => {
	if (optionsInitialized)
		return options;

	optionsInitialized = true;

	const plugin = file.opts?.plugins?.find(plugin =>
		(plugin as PluginPass).key === 'lit-jsx-transform') as { options?: PluginOptions; };

	const pluginOptions = plugin?.options || {};
	pluginOptions.useCompiledTemplates ??= true;

	for (const [ key, value ] of Object.entries(pluginOptions))
		options[key as keyof typeof options] = value as any;

	console.log(`Lit JSX plugin options initialized:`, options);

	return pluginOptions;
};


export const getPluginOptions = (file: BabelFile): PluginOptions => {
	const plugin = file.opts?.plugins?.find(plugin =>
		(plugin as PluginPass).key === 'lit-jsx-transform') as { options?: PluginOptions; };

	return plugin.options ?? {};
};


let optionsInitialized = false;
export const options: PluginOptions = {};
