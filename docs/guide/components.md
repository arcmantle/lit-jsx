# Components

lit-jsx supports two types of components, each serving different purposes:

## Component Types

### [Functional Components](/guide/functional-components)

Simple functions that return JSX. Perfect for stateless UI components.

```tsx
function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}!</h1>
}
```

**Use when:**

- You need simple, stateless rendering
- You want to compose UI from smaller pieces
- You don't need lifecycle methods or reactive properties

[Learn more →](/guide/functional-components)

### [Custom Elements](/guide/custom-elements)

LitElement classes with reactive properties and lifecycle methods. Perfect for stateful, reusable Web Components.

```tsx
import { LitElement } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('counter-element')
class Counter extends LitElement {
  @property({ type: Number }) count = 0

  render() {
    return <button onclick={() => this.count++}>Count: {this.count}</button>
  }
}
```

**Use when:**

- You need reactive properties that trigger re-renders
- You want lifecycle methods and encapsulated state
- You're building reusable Web Components

[Learn more →](/guide/custom-elements)

## Next Steps

- [Functional Components](/guide/functional-components) - Learn about stateless function components
- [Custom Elements](/guide/custom-elements) - Learn about stateful LitElement components
- [Bindings](/guide/bindings) - How to bind data to elements
- [Directives](/guide/directives) - Special rendering behaviors
