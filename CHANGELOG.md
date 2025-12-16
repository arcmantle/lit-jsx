# Changelog

All notable changes to jsx-lit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project tries but usually fails to adhere with [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.34] - 2025-12-17

### Breaking Changes

- **Event Handler Syntax**: Changed event binding syntax from hyphenated `on-event` to React-style `onevent` format
  - Old syntax: `<button on-click={handler}>`
  - New syntax: `<button onclick={handler}>`
  - This change makes lit-jsx more familiar to developers from React and aligns with standard DOM event handler naming
  - All event handlers now use the `on` prefix followed by the lowercase event name (e.g., `onclick`, `onmouseover`, `onsubmit`, `onkeydown`)

### Major Changes

- **Type System Overhaul**: Completely rewrote the type system for better accuracy and maintainability
  - Now uses TypeScript type mappings and relies on native HTML types from `lib.dom.d.ts`
  - Split types into three focused files: `jsx-core.ts` (core JSX types), `jsx-dom.ts` (DOM element mappings), and `jsx-hooks.ts` (hooks and utilities)
  - HTML, SVG, and MathML element tag names are now directly mapped to their corresponding DOM element types
  - Significantly improved type inference for all native elements
  - Better IntelliSense support for element properties and attributes

- **Direct Class Component Support**: LitElement and other custom element classes can now be used directly in JSX
  - Use any class extending `LitElement` or `HTMLElement` directly as a JSX component with the `static` attribute
  - Full automatic support for generic custom element classes - no manual type annotations required
  - Example: `<MyElement static prop={value} />` where `MyElement` is a class extending `LitElement`

### Improvements

- Enhanced code maintainability with improved structure and organization
- Better separation of concerns in type definitions
- More reliable type checking for JSX elements

### Migration Guide

To update your code from v1.0.33 to v1.0.34:

1. **Update event handlers** - Replace all hyphenated event handlers with React-style syntax:

   ```tsx
   // Old (v1.0.33)
   <button on-click={handleClick}>Click</button>
   <input on-change={handleChange} on-blur={handleBlur} />
   <form on-submit={handleSubmit}>

   // New (v1.0.34)
   <button onclick={handleClick}>Click</button>
   <input onchange={handleChange} onblur={handleBlur} />
   <form onsubmit={handleSubmit}>
   ```

2. **Type definitions** - No changes required, but you may notice improved type inference and IntelliSense

3. **Custom element usage** - LitElement classes can now be used directly in JSX:

   ```tsx
   // Simply use the class with the static attribute
   <MyButton static onclick={handler} />
   ```

## [1.0.33] - 2025-09-07

- **Breaking Change**: Import discovery is now opt-in. The new default way to identify a tagged or custom element is by using the static attribute on it
- Compiled templates are now enabled by default and will skip static compilation when children of an element contain expressions with values that are not statically known to be JSX elements
- Improved performance and reliability by making template compilation the default behavior while maintaining safety checks for dynamic content

## [1.0.28] - 2025-07-23

- Compiled templates are now turned off by default as they are still experimental
- Compiled templates can be enabled by setting the appropriate configuration option
- This change addresses potential bugs related to nested child rendering

## [1.0.15] - 2025-07-19

- Identified and attempted fix for an issue with compiled parts indexes
- Improved reliability of template part indexing during compilation

## [1.0.14] - 2025-07-17

- Added support for TypeScript type annotations (`ToComponent` and `ToTag` types) to optimize compiler detection of custom elements and dynamic tags
- Function parameters can now be typed with `ToComponent`, `ToTag`, or `typeof` references to ensure proper compilation
- Enhanced performance by allowing the compiler to skip traversal when components are properly typed
- **Breaking Change**: Functions that accept custom element or dynamic tag parameters now require explicit TypeScript typing:
  - Use `ToComponent` type for custom element parameters
  - Use `ToTag` type for dynamic tag parameters
  - Use `typeof` with a `toComponent()` or `toTag()` reference for specific component types
- Updated documentation with examples and best practices for parameter typing

## [1.0.13] - 2025-07-16

- The import discovery process has been completely recreated and now supports all types of imports, exports, and declarations for identifying `toComponent` and `toTag` call expressions.
- This enhancement ensures robust detection of components and dynamic tags, regardless of how they are imported, exported, or re-exported across files.
- Improved reliability and scalability for large codebases with complex module structures.

## [1.0.10] - 2025-07-12

- Custom elements and dynamic tags no longer require the `.tag` postfix when using `toComponent` or `toTag` helper functions
- The transpiler now automatically detects components defined with `toComponent` or `toTag` helpers, eliminating the need for manual `.tag` annotations
- Improved developer experience by reducing boilerplate code required for custom element definitions
