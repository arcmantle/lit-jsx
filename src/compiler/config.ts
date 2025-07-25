import type { BabelFile, PluginPass } from '@babel/core';

export type BabelPlugins = NonNullable<NonNullable<babel.TransformOptions['parserOpts']>['plugins']>;


export const babelPlugins: Set<BabelPlugins[number]> = new Set([ 'jsx', 'typescript', 'decorators', 'decoratorAutoAccessors' ]);
export const debugMode = { value: false };


export const COMPONENT_LITERAL_PREFIX = '__$';
export const WHITESPACE_TAGS: string[] = [ 'pre', 'textarea' ];
export const SPECIAL_TAGS: string[] = [];
export const ATTR_NAMES = {
	REF:          'ref',
	CLASS_LIST:   'classList',
	STYLE_LIST:   'styleList',
	DIRECTIVE:    'directive',
	EVENT_PREFIX: 'on-',
} as const;
export const ATTR_BIND_OBJ_NAME = 'as';
export const ATTR_VALUES = {
	BOOL: 'bool',
	PROP:	'prop',
} as const;
export const VARIABLES = {
	HTML:                'html',
	HTML_LOCAL:          '__$html',
	HTML_STATIC:         'html',
	HTML_STATIC_LOCAL:   '__$htmlStatic',
	SVG:                 'svg',
	SVG_LOCAL:           '__$svg',
	SVG_STATIC:          'svg',
	SVG_STATIC_LOCAL:    '__$svgStatic',
	MATHML:              'mathml',
	MATHML_LOCAL:        '__$mathml',
	MATHML_STATIC:       'mathml',
	MATHML_STATIC_LOCAL: '__$mathmlStatic',
	UNSAFE_STATIC:       'unsafeStatic',
	UNSAFE_STATIC_LOCAL: '__$unsafeStatic',
	CLASS_MAP:           'classMap',
	CLASS_MAP_LOCAL:     '__$classMap',
	STYLE_MAP:           'styleMap',
	STYLE_MAP_LOCAL:     '__$styleMap',
	REF:                 'ref',
	REF_LOCAL:           '__$ref',

	REST:                 '__$rest',
	LITERAL_MAP:          '__$literalMap',
	TAGGED_TEMPLATE_UTIL: '__$t',
	BOOLEAN_PART:         'BooleanPart',
	ATTRIBUTE_PART:       'AttributePart',
	PROPERTY_PART:        'PropertyPart',
	ELEMENT_PART:         'ElementPart',
	EVENT_PART:           'EventPart',
	CHILD_PART:           'ChildPart',
} as const;
export const SOURCES = {
	HTML:              'lit-html',
	HTML_ALT:          'lit',
	HTML_STATIC:       'lit-html/static.js',
	HTML_STATIC_ALT:   'lit/static-html.js',
	SVG:               'lit-html/directives/svg.js',
	SVG_ALT:           'lit/directives/svg.js',
	MATHML:            'lit-html/directives/mathml.js',
	MATHML_ALT:        'lit/directives/mathml.js',
	SVG_STATIC:        'lit-html/static.js',
	SVG_STATIC_ALT:    'lit/static-html.js',
	MATHML_STATIC:     'lit-html/static.js',
	MATHML_STATIC_ALT: 'lit/static-html.js',
	UNSAFE_STATIC:     'lit-html/static.js',
	UNSAFE_STATIC_ALT: 'lit/static-html.js',
	REF:               'lit-html/directives/ref.js',
	REF_ALT:           'lit/directives/ref.js',
	CLASS_MAP:         'lit-html/directives/class-map.js',
	CLASS_MAP_ALT:     'lit/directives/class-map.js',
	STYLE_MAP:         'lit-html/directives/style-map.js',
	STYLE_MAP_ALT:     'lit/directives/style-map.js',
	REST:              '@arcmantle/lit-jsx',
	LITERAL_MAP:       '@arcmantle/lit-jsx',
	JSX_LIT:           '@arcmantle/lit-jsx',
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


export const initializePluginOptions = (file: BabelFile): { useCompiledTemplates?: boolean; } => {
	if (optionsInitialized)
		return options;

	optionsInitialized = true;

	const plugin = file.opts?.plugins
		?.find(plugin => (plugin as PluginPass).key === 'lit-jsx-transform') as { options?: { useCompiledTemplates?: boolean; }; };

	const pluginOptions = plugin?.options || {};

	for (const [ key, value ] of Object.entries(pluginOptions))
		options[key as keyof typeof options] = value as any;

	console.log(`Lit JSX plugin options initialized:`, options);


	return pluginOptions;
};


let optionsInitialized = false;
export const options: { useCompiledTemplates?: boolean; } = {};
