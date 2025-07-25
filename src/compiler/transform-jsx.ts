import type { PluginPass } from '@babel/core';
import type { NodePath, VisitNode } from '@babel/traverse';
import type { JSXElement, JSXFragment } from '@babel/types';
import { isJSXElement, isJSXFragment } from '@babel/types';

import { getTemplateType, isJSXElementStatic, isJSXFunctionElementComponent } from './compiler-utils.js';
import { options } from './config.js';
import { CompiledTranspiler, TemplateTranspiler } from './transpiler.js';


export const transformJSXElement: VisitNode<
	PluginPass, JSXElement | JSXFragment
> = (path): void => {
	// If the parent is a JSX element, we do not need to transform it.
	// The below condition will handle the case where the JSX element
	// is nested inside another JSX element.
	if (isJSXElement(path.parent) || isJSXFragment(path.parent))
		return;

	// If the parent is not a JSX element,
	// we need to wrap the JSX in a tagged template expression
	return void path.replaceWith(processJSXElement(path));
};


const processJSXElement = (path: NodePath<JSXElement | JSXFragment>) => {
	const isFunctionComponent = isJSXFunctionElementComponent(path);

	// A root function component needs to be immediately created.
	if (isFunctionComponent)
		return new TemplateTranspiler().createFunctionalComponent(path);

	const isStatic = isJSXElementStatic(path);
	const templateType = getTemplateType(path);

	// If the element is static, we need to use the template transpiler.
	if (isStatic || templateType !== 'html')
		return new TemplateTranspiler().start(path);

	if (options.useCompiledTemplates)
		// A non static, non function component can be transpiled using the compiled transpiler.
		return new CompiledTranspiler().start(path);
	else
		return new TemplateTranspiler().start(path);
};
