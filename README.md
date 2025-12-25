# lit-jsx

A powerful JSX compiler and Vite plugin that transforms JSX into native Lit templates at compile time with zero runtime overhead.

📖 **[View Full Documentation](./docs/)** | 🚀 [Getting Started](./docs/guide/getting-started.md) | 📦 [Installation](./docs/guide/installation.md)

## 🚀 Features

lit-jsx brings the familiar JSX syntax to the Lit ecosystem while maintaining the performance and capabilities that make Lit exceptional.

```tsx
// Write familiar JSX
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

// Compiles to efficient Lit templates
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

### ✨ Key Benefits

- **⚡ Zero Runtime Overhead**: Pure compile-time transformation to native Lit templates
- **🎯 Type-Safe**: Comprehensive TypeScript support with native DOM type mappings for accurate IntelliSense and type checking
- **🔧 Vite Integration**: Seamless setup with the included Vite plugin
- **🎨 Lit Ecosystem**: Works with all Lit directives, custom elements, and patterns
- **🎛️ Flexible Binding**: Fine-grained control over attribute, property, and boolean bindings
- **🏷️ Dynamic Tags**: Support for conditional element types with static template optimization
- **📦 Function Components**: Full support for composable function components
- **🔗 Custom Elements**: Use LitElement classes directly in JSX with automatic generic type support
- **🧩 Library Components**: Built-in `For`, `Show`, and `Choose` components for common rendering patterns

## 📦 Installation

```bash
npm install @arcmantle/lit-jsx lit-html
# or
pnpm add @arcmantle/lit-jsx lit-html
# or
yarn add @arcmantle/lit-jsx lit-html
```

## ⚡ Quick Start

For complete setup instructions, see the [Installation Guide](./docs/guide/installation.md) and [Getting Started Guide](./docs/guide/getting-started.md).

### 1. Configure Vite

```typescript
// vite.config.ts
import { litJsx } from '@arcmantle/lit-jsx/vite-jsx-preserve';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    litJsx({
      legacyDecorators: true
    })
  ],
});
```

### 2. Configure TypeScript

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "@arcmantle/lit-jsx"
  }
}
```

### 3. Start Writing JSX

```tsx
import { LitElement } from 'lit';
import { For, Show, Choose } from '@arcmantle/lit-jsx';

export class MyComponent extends LitElement {
  render() {
    return (
      <div>
        <h1>Hello lit-jsx!</h1>
        <p>JSX compiled to Lit templates with utility components</p>

        <Show when={this.items.length > 0}>
          {(length) => (
            <For each={this.items}>
              {(item, index) => <div>{item}</div>}
            </For>
          )}
        </Show>
      </div>
    );
  }
}
```

## 🎯 Core Concepts

For complete documentation, visit the [full documentation site](./docs/).

### Custom Element Identification

- **Tag names** (like `<counter-element>`) work directly without special attributes
- **Classes** (like `<Counter />`) require the `static` attribute
- Optional: Enable `useImportDiscovery: true` for automatic detection

[Learn more →](./docs/guide/custom-elements.md)

### Attribute Binding Control

- **Default**: Attribute binding (`value={x}`)
- **`as.prop()`**: Property binding (`.property=${x}`)
- **`as.bool()`**: Boolean attribute binding (`?disabled=${x}`)

[Learn more →](./docs/guide/bindings.md)

### Special Attributes

- **`classList` / `class={{...}}`**: Conditional classes with `classMap`
- **`styleList` / `style={{...}}`**: Dynamic styles with `styleMap`
- **`onclick`, `onchange`, etc.**: Event handlers
- **`ref`**: Element references
- **`directive`**: Apply Lit directives
- **`{...props}`**: Spread attributes

[Full syntax guide →](./docs/guide/jsx-syntax.md)

## 🏗️ Component Patterns

### Function Components

Stateless components that receive props and return JSX. Support TypeScript, generics, children, and all JSX features.

[Learn more →](./docs/guide/functional-components.md)

### Custom Elements

Use LitElement classes directly in JSX with full type safety and generic support. Classes require the `static` attribute.

[Learn more →](./docs/guide/custom-elements.md)

### Dynamic Tags

Use `as.tag()` for conditional element types with optimized static templates.

[Component guide →](./docs/guide/components.md)

### Library Components

Built-in components for common patterns:

- **`<For>`**: List rendering with keys and separators
- **`<Show>`**: Conditional rendering with optional fallback
- **`<Choose>`**: Switch-like multi-condition rendering

## 🔧 Advanced Usage

For comprehensive guides, examples, and best practices, see the [full documentation](./docs/).

- **Lit Directives**: Use all Lit directives (`when`, `repeat`, `guard`, etc.)
- **Performance**: Optimization tips and compiled templates
- **TypeScript**: Advanced typing patterns

[View advanced guides →](./docs/guide/performance.md)

## 🎛️ Configuration

Plugin options:

- `legacyDecorators`: Enable legacy decorator support
- `useCompiledTemplates`: Compile-time template optimization (default: true)
- `useImportDiscovery`: Auto-detect custom elements (default: false)

[Full configuration guide →](./docs/guide/vite-plugin.md)

## 🔗 Ecosystem & Migration

Full compatibility with:

- LitElement and reactive properties
- All Lit directives
- Web Components standards
- TypeScript with native DOM types

Migrating from React or Lit templates? See the [migration guide](./CHANGELOG.md).

## 🤝 Contributing

Contributions, issues or requests are welcome!

## 📄 License

Apache-2.0

...
