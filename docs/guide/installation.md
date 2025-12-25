# Installation

## Install the Package

First, add lit-jsx to your project:

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

Add the lit-jsx Vite plugin to your `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import { litJsx } from '@arcmantle/lit-jsx/vite'

export default defineConfig({
  plugins: [
    litJsx({
      // Optional configuration
      include: /\.(tsx|jsx)$/,
      exclude: /node_modules/,
    }),
  ],
})
```

## Configure TypeScript

Update your `tsconfig.json` to enable JSX support:

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "@arcmantle/lit-jsx",
    "types": ["vite/client"]
  }
}
```

## Verify Installation

Create a simple component to test your setup:

```tsx
// src/my-element.tsx
import { LitElement, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('my-element')
export class MyElement extends LitElement {
  @property() name = 'World'

  render() {
    return (
      <div>
        <h1>Hello, {this.name}!</h1>
        <button onclick={() => console.log('clicked')}>
          Click me
        </button>
      </div>
    )
  }
}
```

If everything is configured correctly, the JSX will compile to efficient Lit templates!

## Next Steps

- Learn about [JSX Syntax](/guide/jsx-syntax) in lit-jsx
- Explore [Components](/guide/components)
- Understand [Bindings](/guide/bindings)
