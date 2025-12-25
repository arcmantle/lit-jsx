# Getting Started

Welcome to lit-jsx! This guide will help you get up and running with JSX in your Lit projects.

## What is lit-jsx?

lit-jsx is a JSX compiler and Vite plugin that transforms JSX syntax into native Lit templates at compile time. Unlike other JSX implementations, lit-jsx has **zero runtime overhead** - all JSX is converted to Lit's efficient template syntax during the build process.

## Why lit-jsx?

### Familiar Syntax

If you've worked with React or other JSX-based frameworks, you'll feel right at home. Write components using the JSX syntax you already know.

### Zero Runtime Cost

The transformation happens entirely at compile time. Your production code contains only native Lit templates, with no additional runtime library overhead.

### Type Safety

Full TypeScript support with accurate DOM type mappings. Get IntelliSense for all HTML attributes, events, and properties.

### Lit Ecosystem

Works seamlessly with all Lit features: directives, custom elements, reactive properties, and more.

## Prerequisites

Before getting started, make sure you have:

- Node.js 18 or later
- A Vite-based project (or create a new one)
- Basic familiarity with Lit and TypeScript

## Next Steps

Continue to the [Installation](/guide/installation) guide to set up lit-jsx in your project.
