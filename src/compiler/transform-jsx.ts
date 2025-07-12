import { type PluginPass } from '@babel/core';
import type { NodePath, VisitNode } from '@babel/traverse';
import * as t from '@babel/types';

import { getTemplateType, isJSXElementStatic, isJSXFunctionElementComponent } from './compiler-utils.js';
import { CompiledTranspiler, TemplateTranspiler } from './transpiler.js';


export const transformJSXElement: VisitNode<
	PluginPass, t.JSXElement | t.JSXFragment
> = (path): void => {
	// If the parent is a JSX element, we do not need to transform it.
	// The below condition will handle the case where the JSX element
	// is nested inside another JSX element.
	if (t.isJSXElement(path.parent) || t.isJSXFragment(path.parent))
		return;

	// If the parent is not a JSX element,
	// we need to wrap the JSX in a tagged template expression
	return void path.replaceWith(processJSXElement(path));
};


const processJSXElement = (path: NodePath<t.JSXElement | t.JSXFragment>) => {
	//console.time('Analyzing if JSX Element is static');
	const isStatic = isJSXElementStatic(path);
	//console.timeEnd('Analyzing if JSX Element is static');

	//console.time('Analyzing template type');
	const templateType = getTemplateType(path);
	//console.timeEnd('Analyzing template type');

	//console.time('Analyzing if JSX Element is a function component');
	const isFunctionComponent = isJSXFunctionElementComponent(path);
	//console.timeEnd('Analyzing if JSX Element is a function component');

	if (isFunctionComponent) {
		//console.time('Functional Component Transpilation');
		const cmp = new TemplateTranspiler().createFunctionalComponent(path);
		//console.timeEnd('Functional Component Transpilation');

		return cmp;
	}

	if (isStatic || templateType !== 'html') {
		//console.time('Static Transpilation');
		const cmp = new TemplateTranspiler().start(path);
		//console.timeEnd('Static Transpilation');

		return cmp;
	}

	//console.time('Compiled Transpilation');
	const cmp = new CompiledTranspiler().start(path);
	//console.timeEnd('Compiled Transpilation');

	return cmp;
};
