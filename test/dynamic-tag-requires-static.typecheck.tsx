/*
 * Type-only coverage for dynamic intrinsic tags.
 *
 * Example:
 *   const Tag = 'a'
 *   <Tag static />  // ok
 */


import type { TemplateResult } from 'lit-html';


// Intrinsic tag: should NOT require `static`.
const _okIntrinsic: TemplateResult = <a href="#" />;


// Dynamic tag: should require `static`.
const ATag = as.tag('a');

// @ts-expect-error - dynamic tags require `static`
const _aMissingStatic: TemplateResult = <ATag href="#" />;

const _aWithStatic: TemplateResult = <ATag href="#" static />;


// Custom element tags should also be supported.
const CustomTag = as.tag('es-button');

// @ts-expect-error - dynamic tags require `static`
const _customMissingStatic: TemplateResult = <CustomTag />;

const _customWithStatic: TemplateResult = <CustomTag static />;
