# Changelog

All notable changes to jsx-lit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project tries to adhere with [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.10] - 2025-07-12

### Changed

- Custom elements and dynamic tags no longer require the `.tag` postfix when using `toComponent` or `toTag` helper functions
- The transpiler now automatically detects components defined with `toComponent` or `toTag` helpers, eliminating the need for manual `.tag` annotations
- Improved developer experience by reducing boilerplate code required for custom element definitions
