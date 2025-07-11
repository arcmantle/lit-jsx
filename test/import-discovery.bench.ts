import babel from '@babel/core';
import { bench } from 'vitest';

import { litJsxBabelPlugin } from '../src/compiler/babel-plugin.ts';
import type { BabelPlugins } from './utils.ts';


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
		plugins: [ 'jsx', 'typescript' ] satisfies BabelPlugins,
	},
});


bench('import-discovery', () => {
	const source = `
		const Button = toTag('custom-button');
		const template = <Button>Click me</Button>;
	`;

	babel.transformSync(source, getOpts())?.code;
});
