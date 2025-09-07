# Changelog

All notable changes to jsx-lit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project tries to adhere with [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
