---
layout: home

hero:
  name: "lit-jsx"
  text: "JSX for Lit"
  tagline: A powerful JSX compiler and Vite plugin that transforms JSX into native Lit templates at compile time with zero runtime overhead
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: API Reference
      link: /api/index
    - theme: alt
      text: View on GitHub
      link: https://github.com/arcmantle/lit-jsx

features:
  - icon: ⚡
    title: Zero Runtime Overhead
    details: Pure compile-time transformation to native Lit templates. No runtime library needed.

  - icon: 🎯
    title: Type-Safe
    details: Comprehensive TypeScript support with native DOM type mappings for accurate IntelliSense and type checking.

  - icon: 🔧
    title: Vite Integration
    details: Seamless setup with the included Vite plugin. Works with your existing Vite configuration.

  - icon: 🎨
    title: Lit Ecosystem
    details: Works with all Lit directives, custom elements, and patterns you already know and love.

  - icon: 🎛️
    title: Flexible Binding
    details: Fine-grained control over attribute, property, and boolean bindings with intuitive syntax.

  - icon: 🏷️
    title: Dynamic Tags
    details: Support for conditional element types with static template optimization.

  - icon: 📦
    title: Function Components
    details: Full support for composable function components with clean, reusable code.

  - icon: 🔗
    title: Custom Elements
    details: Use LitElement classes directly in JSX with automatic generic type support.
---

## Quick Example

Write familiar JSX that compiles to efficient Lit templates:

```tsx
function TodoItem({ todo, onToggle, onDelete }) {
  return (
    <div classList={{ completed: todo.completed }}>
      <input
        type="checkbox"
        checked={as.prop(todo.completed)}
        disabled={as.bool(todo.readonly)}
        onchange={() => onToggle(todo.id)}
      />
      <span>{todo.text}</span>
      <button onclick={() => onDelete(todo.id)}>Delete</button>
    </div>
  );
}
```

This compiles to:

```ts
html`
  <div class=${classMap({ completed: todo.completed })}>
    <input
      type="checkbox"
      .checked=${todo.completed}
      ?disabled=${todo.readonly}
      @change=${() => onToggle(todo.id)}
    />
    <span>${todo.text}</span>
    <button @click=${() => onDelete(todo.id)}>Delete</button>
  </div>
`
```

## Installation

::: code-group

```sh [npm]
npm install @arcmantle/lit-jsx
```

```sh [pnpm]
pnpm add @arcmantle/lit-jsx
```

```sh [yarn]
yarn add @arcmantle/lit-jsx
```

:::

## Configure Vite

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { litJsx } from '@arcmantle/lit-jsx/vite'

export default defineConfig({
  plugins: [litJsx()],
})
```

## Configure TypeScript

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "@arcmantle/lit-jsx"
  }
}
```

Now you're ready to start using JSX with Lit! 🚀
