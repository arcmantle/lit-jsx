import babel from '@babel/core';
import { bench } from 'vitest';

import { litJsxBabelPlugin } from '../src/compiler/babel-plugin.ts';
import { babelPlugins } from '../src/compiler/config.ts';


const getOpts = (): babel.TransformOptions => ({
	root:           '.',
	filename:       'test.tsx',
	sourceFileName: 'test.tsx',
	plugins:        [ litJsxBabelPlugin() ],
	ast:            false,
	sourceMaps:     false,
	configFile:     false,
	babelrc:        false,
	parserOpts:     {
		plugins: Array.from(babelPlugins),
	},
});


bench('import-discovery', () => {
	const source = `
		const Button = toTag('custom-button');
		const template = <Button>Click me</Button>;
	`;

	babel.transformSync(source, getOpts())?.code;
});
