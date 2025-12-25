# Bindings

Learn how to control how JSX attributes bind to DOM elements.

## Overview

lit-jsx provides fine-grained control over how values bind to DOM elements through special prefixes and helpers. This maps directly to Lit's binding syntax.

## Attribute Bindings (default)

By default, values are bound as attributes:

```tsx
<input type="text" value="hello" />

// Compiles to
html`<input type="text" value="hello" />`
```

## Property Bindings

Use `as.prop()` to bind to properties instead of attributes:

```tsx
<input type="checkbox" checked={as.prop(isChecked)} />

// Compiles to
html`<input type="checkbox" .checked=${isChecked} />`
```

This is important for properties that don't have attribute equivalents or when you need to pass complex objects:

```tsx
<custom-element data={as.prop(complexObject)} />

// Compiles to
html`<custom-element .data=${complexObject}></custom-element>`
```

## Boolean Attributes

Use `as.bool()` for boolean attributes:

```tsx
<button disabled={as.bool(isDisabled)}>Submit</button>

// Compiles to
html`<button ?disabled=${isDisabled}>Submit</button>`
```

The boolean will only be present when the value is truthy, and removed when falsy.

## Event Bindings

Events are automatically detected by the `on` prefix:

```tsx
<button onclick={handleClick}>Click</button>
<input oninput={handleInput} />
<form onsubmit={handleSubmit} />

// Compiles to
html`
  <button @click=${handleClick}>Click</button>
  <input @input=${handleInput} />
  <form @submit=${handleSubmit} />
`
```

### Event Handler Types

Event handlers receive the standard DOM event:

```tsx
function MyComponent() {
  const handleClick = (e: MouseEvent) => {
    console.log('Clicked at', e.clientX, e.clientY)
  }

  const handleInput = (e: InputEvent) => {
    const target = e.target as HTMLInputElement
    console.log('Value:', target.value)
  }

  return (
    <>
      <button onclick={handleClick}>Click</button>
      <input oninput={handleInput} />
    </>
  )
}
```

## Class Bindings

### classList

Use `classList` for conditional classes:

```tsx
<div classList={{
  active: isActive,
  disabled: !enabled,
  'has-error': hasError
}}>
  Content
</div>

// Compiles to
html`<div class=${classMap({
  active: isActive,
  disabled: !enabled,
  'has-error': hasError
})}>Content</div>`
```

::: tip Shorthand
You can also use `class` with an object literal for convenience:

```tsx
<div class={{ active: isActive, disabled: !enabled }}>
```

This automatically uses `classMap`. For variables, use `classList={myClasses}` instead.
:::

### class

For static class strings:

```tsx
<div class="btn btn-primary">Button</div>

// Compiles to
html`<div class="btn btn-primary">Button</div>`
```

## Style Bindings

Use the `style` object for dynamic inline styles:

```tsx
<div style={{
  color: textColor,
  fontSize: `${size}px`,
  backgroundColor: bgColor
}}>
  Styled content
</div>

// Compiles to
html`<div style=${styleMap({
  color: textColor,
  fontSize: `${size}px`,
  backgroundColor: bgColor
})}>Styled content</div>`
```

## Ref Bindings

Get a reference to DOM elements using `ref`:

```tsx
import { ref } from 'lit/directives/ref.js'
import { createRef } from 'lit/directives/ref.js'

function MyComponent() {
  const inputRef = createRef()

  const focusInput = () => {
    inputRef.value?.focus()
  }

  return (
    <>
      <input ref={ref(inputRef)} type="text" />
      <button onclick={focusInput}>Focus Input</button>
    </>
  )
}
```

## Directive Bindings

Lit directives can be used directly:

```tsx
import { until } from 'lit/directives/until.js'
import { when } from 'lit/directives/when.js'

function AsyncContent() {
  const fetchData = async () => {
    const response = await fetch('/api/data')
    return response.json()
  }

  return (
    <div>
      {until(
        fetchData().then(data => <div>{data}</div>),
        <div>Loading...</div>
      )}
    </div>
  )
}

function ConditionalRender({ show, content }) {
  return (
    <div>
      {when(show, () => content)}
    </div>
  )
}
```

## Custom Bindings

Combine bindings for complex scenarios:

```tsx
function ComplexComponent({ data, handlers }) {
  return (
    <custom-element
      // Property binding for complex data
      config={as.prop(data.config)}

      // Boolean attribute
      disabled={as.bool(data.isDisabled)}

      // Event binding
      onchange={handlers.onChange}

      // Class binding
      classList={{
        active: data.isActive,
        error: data.hasError
      }}

      // Style binding
      style={{
        width: `${data.width}px`,
        height: `${data.height}px`
      }}
    />
  )
}
```

## Next Steps

- Learn about [Directives](/guide/directives)
- Explore the [Vite Plugin](/guide/vite-plugin)
- Check out the [API Reference](/api/index)
