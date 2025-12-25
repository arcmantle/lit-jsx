# Performance

Learn how to optimize your lit-jsx applications for maximum performance.

## Zero Runtime Overhead

The most important performance feature of lit-jsx is that it has **zero runtime overhead**. All JSX is transformed to native Lit templates at compile time.

```tsx
// Your JSX code
<div class="container">
  <h1>{title}</h1>
  <p>{description}</p>
</div>

// Compiles directly to
html`
  <div class="container">
    <h1>${title}</h1>
    <p>${description}</p>
  </div>
`
```

No JSX runtime library is included in your bundle. The transformation happens entirely during the build process.

## Static Templates

Lit templates are parsed once and reused. lit-jsx preserves this optimization:

```tsx
// This template is parsed once
function Greeting({ name }) {
  return <div>Hello, {name}!</div>
}

// Even when called multiple times, the template structure is reused
<Greeting name="Alice" />
<Greeting name="Bob" />
<Greeting name="Charlie" />
```

## Efficient Updates

Lit only updates the dynamic parts of templates:

```tsx
function Counter({ count }) {
  return (
    <div>
      <h1>Counter</h1>
      <p>Count: {count}</p>
      <button>Increment</button>
    </div>
  )
}

// When count changes:
// - The structure (<div>, <h1>, <p>, <button>) stays the same
// - Only the {count} value is updated in the DOM
```

## Conditional Rendering

Use JavaScript expressions for efficient conditional rendering:

```tsx
function Message({ type, text }) {
  return (
    <div>
      {type === 'error' && <ErrorIcon />}
      {text}
    </div>
  )
}

// Only ErrorIcon is added/removed when type changes
```

## List Rendering

For optimal list performance, use the `repeat` directive with keys:

```tsx
import { repeat } from 'lit/directives/repeat.js'

function TodoList({ todos }) {
  return (
    <ul>
      {repeat(
        todos,
        (todo) => todo.id,  // Key function
        (todo) => <li>{todo.text}</li>
      )}
    </ul>
  )
}
```

Without keys, Lit updates all items. With keys, Lit only updates changed items.

## Memoization with guard

Use the `guard` directive to skip expensive re-renders:

```tsx
import { guard } from 'lit/directives/guard.js'

function ExpensiveComponent({ data }) {
  const processData = (data) => {
    // Expensive computation
    return data.map(item => transform(item))
  }

  return (
    <div>
      {guard([data], () => (
        <div>{processData(data)}</div>
      ))}
    </div>
  )
}

// processData only runs when data changes
```

## Cache for Tab Panels

Use `cache` to preserve DOM for tab panels:

```tsx
import { cache } from 'lit/directives/cache.js'

function TabPanel({ activeTab }) {
  return (
    <div>
      {as.directive(cache(
        activeTab === 'home' ? <HomePage /> :
        activeTab === 'profile' ? <ProfilePage /> :
        <SettingsPage />
      ))}
    </div>
  )
}

// DOM is preserved when switching tabs
// No need to recreate the tab content
```

## Event Delegation

Lit automatically uses event delegation for better performance:

```tsx
function TodoList({ todos, onToggle }) {
  return (
    <ul>
      {todos.map(todo => (
        <li>
          <input
            type="checkbox"
            checked={as.prop(todo.completed)}
            onchange={() => onToggle(todo.id)}
          />
          {todo.text}
        </li>
      ))}
    </ul>
  )
}

// Lit uses a single event listener on the parent
// Instead of one per checkbox
```

## Lazy Loading

Lazy load components with dynamic imports:

```tsx
import { until } from 'lit/directives/until.js'

function App() {
  const HeavyComponent = import('./HeavyComponent.js')
    .then(m => m.default)

  return (
    <div>
      {as.directive(until(
        HeavyComponent.then(Component => <Component />),
        <div>Loading...</div>
      ))}
    </div>
  )
}
```

## Virtual Scrolling

For long lists, consider virtual scrolling:

```tsx
import { virtualScroll } from '@arcmantle/virtualizer'

function LongList({ items }) {
  return (
    <div>
      {as.directive(virtualScroll({
        items,
        renderItem: (item) => <div>{item.name}</div>,
        itemHeight: 50,
      }))}
    </div>
  )
}

// Only visible items are rendered
```

## Property Bindings vs Attributes

Use property bindings for better performance with complex data:

```tsx
// Slow: JSON serialization on every update
<custom-element config="${JSON.stringify(config)}" />

// Fast: Direct property assignment
<custom-element config={as.prop(config)} />
```

## Avoid Inline Functions (When It Matters)

For frequently updated components, avoid creating new functions on every render:

```tsx
// Less optimal: New function on every render
function TodoItem({ todo }) {
  return (
    <div onclick={() => handleClick(todo.id)}>
      {todo.text}
    </div>
  )
}

// Better: Stable function reference
function TodoItem({ todo, onClick }) {
  return (
    <div onclick={onClick}>
      {todo.text}
    </div>
  )
}
```

Note: This optimization is only important for high-frequency updates.

## Bundle Size

lit-jsx has zero runtime overhead, so your bundle only contains:

- Lit library (~7KB gzipped)
- Your component code
- Directives you actually use

Compare this to React JSX:

- React library (~40KB gzipped)
- React DOM (~130KB gzipped)
- JSX runtime

## Build Optimization

The Vite plugin optimizes during build:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { litJsx } from '@arcmantle/lit-jsx/vite'

export default defineConfig({
  plugins: [litJsx()],
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        dead_code: true,
        drop_debugger: true,
      },
    },
  },
})
```

## Measuring Performance

Use browser DevTools to measure performance:

```tsx
function App() {
  performance.mark('render-start')

  const result = (
    <div>
      <Header />
      <MainContent />
      <Footer />
    </div>
  )

  performance.mark('render-end')
  performance.measure('render', 'render-start', 'render-end')

  return result
}
```

## Best Practices

1. **Use Static Templates**: Let Lit parse templates once
2. **Key Your Lists**: Use `repeat` with keys for lists
3. **Guard Expensive Renders**: Use `guard` for heavy computations
4. **Cache Tab Content**: Use `cache` for tab panels
5. **Property Bindings**: Use `as.prop()` for complex data
6. **Lazy Load**: Split code with dynamic imports
7. **Virtual Scroll**: Use virtual scrolling for long lists

## Performance Checklist

- [ ] Using property bindings for complex data
- [ ] Keys on list items with `repeat` directive
- [ ] `guard` directive for expensive computations
- [ ] `cache` directive for tab panels
- [ ] Lazy loading heavy components
- [ ] Virtual scrolling for long lists
- [ ] Avoiding unnecessary re-renders
- [ ] Measuring with DevTools

## Next Steps

- Check out the [API Reference](/api/index)
- Explore the source code on [GitHub](https://github.com/arcmantle/lit-jsx)
- Join the community discussions
