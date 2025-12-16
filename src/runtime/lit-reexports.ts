/**
 * Re-exports of lit-html functionality used by the transpiler.
 * This allows consumers to use @arcmantle/lit-jsx without having direct lit-html dependencies.
 * Only exports what the transpiler actually generates in its output code.
 */

// Core template tags
export { html, mathml, svg } from 'lit-html';

// Static template tags
export { html as htmlStatic, mathml as mathmlStatic, svg as svgStatic, unsafeStatic } from 'lit-html/static.js';

// Directives
export { classMap } from 'lit-html/directives/class-map.js';
export { ref } from 'lit-html/directives/ref.js';
export { styleMap } from 'lit-html/directives/style-map.js';
