# Custom Elements

Custom elements (LitElement classes) provide reactive properties, lifecycle methods, and encapsulated state. They are Web Components that extend `LitElement`.

## Basic Custom Element

Create a custom element by extending `LitElement` and using decorators:

```tsx
import { LitElement } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

@customElement('counter-element')
class Counter extends LitElement {
  @property({ type: Number }) count = 0
  @state() private message = ''

  private increment() {
    this.count++
    this.message = `Clicked ${this.count} times`
  }

  render() {
    return (
      <div>
        <button onclick={() => this.increment()}>
          Count: {this.count}
        </button>
        {this.message && <p>{this.message}</p>}
      </div>
    )
  }
}

// Usage - tag name doesn't need static attribute
<counter-element count={5} />
```

## Using Custom Elements

### Using the Registered Tag Name

When you register a custom element with `@customElement('counter-element')`, you can use the tag name directly:

```tsx
// ✅ Using the registered tag name
<counter-element count={5} />
<my-button onclick={handleClick}>Click</my-button>
```

### Using the Class Directly

You can also use the class itself as a component, which requires the `static` attribute:

```tsx
import { Counter } from './counter-element'

// ✅ Using class directly - requires static attribute
<Counter static={true} count={5} />

// You can also use the shorthand (but explicit form helps IntelliSense)
<Counter static count={5} />

// ❌ Without static - won't compile correctly
<Counter count={5} />
```

::: tip
You can enable automatic class detection by setting `useImportDiscovery: true` in your Vite config, which eliminates the need for the `static` attribute when using classes directly.
This comes at the cost of slightly higher compilation time, as it needs to track the import back to its declaration.
:::

## Custom Element with Styles

Use the `static styles` property for component styles:

```tsx
import { LitElement, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('styled-button')
class StyledButton extends LitElement {
  @property({ type: String }) label = 'Click me'
  @property({ type: String }) variant: 'primary' | 'secondary' = 'primary'

  static styles = css`
    :host {
      display: inline-block;
    }

    button {
      padding: 8px 16px;
      border-radius: 4px;
      border: none;
      cursor: pointer;
    }

    .primary {
      background: blue;
      color: white;
    }

    .secondary {
      background: gray;
      color: white;
    }
  `

  render() {
    return (
      <button class={this.variant}>
        {this.label}
      </button>
    )
  }
}

// Usage
<styled-button label="Submit" variant="primary" />
```

## Generic Custom Elements

Custom elements can use TypeScript generics for type-safe properties:

```tsx
import { LitElement } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('data-list')
class DataList<T> extends LitElement {
  @property({ type: Array }) items: T[] = []
  @property({ attribute: false }) renderItem!: (item: T) => JSX.Element

  render() {
    return (
      <ul>
        {this.items.map((item, index) => (
          <li key={index}>{this.renderItem(item)}</li>
        ))}
      </ul>
    )
  }
}

// Usage
<data-list
  items={as.prop(users)}
  renderItem={as.prop((user: User) => <span>{user.name}</span>)}
/>
```

### Generic Custom Element with Styles

```tsx
import { LitElement, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'

interface Selectable {
  id: string
  label: string
}

@customElement('selectable-list')
class SelectableList<T extends Selectable> extends LitElement {
  @property({ type: Array }) items: T[] = []
  @property({ type: String }) selectedId?: string
  @property({ attribute: false }) onSelect?: (item: T) => void

  static styles = css`
    ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    li {
      padding: 8px;
      cursor: pointer;
      border-bottom: 1px solid #eee;
    }

    li:hover {
      background: #f5f5f5;
    }

    li.selected {
      background: #e3f2fd;
      font-weight: bold;
    }
  `

  private handleSelect(item: T) {
    this.onSelect?.(item)
  }

  render() {
    return (
      <ul>
        {this.items.map(item => (
          <li
            key={item.id}
            class={item.id === this.selectedId ? 'selected' : ''}
            onclick={() => this.handleSelect(item)}
          >
            {item.label}
          </li>
        ))}
      </ul>
    )
  }
}

// Usage
<selectable-list items={as.prop(items)} onSelect={as.prop(handleSelect)} />
```

## Declaring Custom Events for IntelliSense

When creating components that dispatch custom events, declare event handler properties using `declare` to get automatic IntelliSense:

```tsx
import { LitElement } from 'lit'
import { customElement, property } from 'lit/decorators.js'

interface Todo {
  id: string
  text: string
  completed: boolean
}

@customElement('todo-item')
class TodoItem extends LitElement {
  @property({ type: Object }) todo!: Todo

  // Use 'declare' for TypeScript-only properties that provide IntelliSense
  // These won't exist at runtime but enable autocomplete for event handlers
  declare ontoggle: ((e: CustomEvent<{ id: string }>) => void) | undefined
  declare ondelete: ((e: CustomEvent<{ id: string }>) => void) | undefined

  private handleToggle() {
    this.dispatchEvent(new CustomEvent('toggle', {
      detail: { id: this.todo.id },
      bubbles: true,
      composed: true
    }))
  }

  private handleDelete() {
    this.dispatchEvent(new CustomEvent('delete', {
      detail: { id: this.todo.id },
      bubbles: true,
      composed: true
    }))
  }

  render() {
    return (
      <div>
        <input
          type="checkbox"
          checked={as.prop(this.todo.completed)}
          onchange={() => this.handleToggle()}
        />
        <span>{this.todo.text}</span>
        <button onclick={() => this.handleDelete()}>Delete</button>
      </div>
    )
  }
}

// Usage - now you get IntelliSense for ontoggle and ondelete!
<todo-item
  todo={as.prop(todo)}
  ontoggle={(e) => handleToggle(e.detail.id)}
  ondelete={(e) => handleDelete(e.detail.id)}
/>
```

::: tip
By using `declare` for event handler properties, you provide IntelliSense without adding runtime overhead. These are TypeScript-only declarations that help with autocomplete and type checking.
:::

## Generic Custom Element with Custom Events

```tsx
import { LitElement } from 'lit'
import { customElement, property } from 'lit/decorators.js'

interface Item {
  id: string
  name: string
}

@customElement('item-selector')
class ItemSelector<T extends Item> extends LitElement {
  @property({ type: Array }) items: T[] = []

  // Declare generic event handlers
  declare onselect: ((e: CustomEvent<T>) => void) | undefined
  declare onremove: ((e: CustomEvent<T>) => void) | undefined

  private selectItem(item: T) {
    this.dispatchEvent(new CustomEvent('select', {
      detail: item,
      bubbles: true,
      composed: true
    }))
  }

  private removeItem(item: T) {
    this.dispatchEvent(new CustomEvent('remove', {
      detail: item,
      bubbles: true,
      composed: true
    }))
  }

  render() {
    return (
      <ul>
        {this.items.map(item => (
          <li key={item.id}>
            <span onclick={() => this.selectItem(item)}>{item.name}</span>
            <button onclick={() => this.removeItem(item)}>×</button>
          </li>
        ))}
      </ul>
    )
  }
}

// Usage
<item-selector
  items={as.prop(items)}
  onselect={(e) => console.log('Selected:', e.detail)}
  onremove={(e) => console.log('Removed:', e.detail)}
/>
```

## Reactive Properties

Use `@property` for public reactive properties and `@state` for internal state:

```tsx
import { LitElement, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

@customElement('search-box')
class SearchBox extends LitElement {
  @property({ type: String }) placeholder = 'Search...'
  @state() private value = ''
  @state() private results: string[] = []

  static styles = css`
    input {
      width: 100%;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
    }
  `

  private handleInput(e: Event) {
    this.value = (e.target as HTMLInputElement).value
    // Simulate search
    this.results = this.performSearch(this.value)
  }

  private performSearch(query: string): string[] {
    // Search logic here
    return []
  }

  render() {
    return (
      <div>
        <input
          type="text"
          placeholder={this.placeholder}
          value={this.value}
          oninput={(e) => this.handleInput(e)}
        />
        <ul>
          {this.results.map(result => (
            <li key={result}>{result}</li>
          ))}
        </ul>
      </div>
    )
  }
}

// Usage
<search-box placeholder="Search users..." />
```

## When to Use Custom Elements

Use custom elements when:

- You need reactive properties that trigger re-renders
- You want lifecycle methods (connectedCallback, disconnectedCallback, etc.)
- You need encapsulated state and styles
- You're building reusable Web Components
- You need to use Lit directives and features

For simple, stateless rendering, use [Functional Components](/guide/functional-components).

## Next Steps

- Learn about [Functional Components](/guide/functional-components)
- Explore [Bindings](/guide/bindings)
- Check out [Directives](/guide/directives)
- See the [LitElement documentation](https://lit.dev/docs/components/defining/)
