# Changelog

All notable changes to jsx-lit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project tries to adhere with [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.10] - 2025-07-12

- Custom elements and dynamic tags no longer require the `.tag` postfix when using `toComponent` or `toTag` helper functions
- The transpiler now automatically detects components defined with `toComponent` or `toTag` helpers, eliminating the need for manual `.tag` annotations
- Improved developer experience by reducing boilerplate code required for custom element definitions

## [1.0.13] - 2025-07-16

- The import discovery process has been completely recreated and now supports all types of imports, exports, and declarations for identifying `toComponent` and `toTag` call expressions.
- This enhancement ensures robust detection of components and dynamic tags, regardless of how they are imported, exported, or re-exported across files.
- Improved reliability and scalability for large codebases with complex module structures.

## [1.0.14] - 2025-07-17

- Added support for TypeScript type annotations (`ToComponent` and `ToTag` types) to optimize compiler detection of custom elements and dynamic tags
- Function parameters can now be typed with `ToComponent`, `ToTag`, or `typeof` references to ensure proper compilation
- Enhanced performance by allowing the compiler to skip traversal when components are properly typed
- **Breaking Change**: Functions that accept custom element or dynamic tag parameters now require explicit TypeScript typing:
  - Use `ToComponent` type for custom element parameters
  - Use `ToTag` type for dynamic tag parameters
  - Use `typeof` with a `toComponent()` or `toTag()` reference for specific component types
- Updated documentation with examples and best practices for parameter typing
