# JSX Syntax

Learn how to use JSX syntax with lit-jsx and how it maps to Lit templates.

## Basic Elements

JSX elements map directly to HTML elements:

```tsx
// JSX
const template = <div>Hello World</div>

// Compiles to
html`<div>Hello World</div>`
```

## Attributes

HTML attributes work as expected:

```tsx
<input type="text" placeholder="Enter name" />
```

## Dynamic Content

Use curly braces `{}` for dynamic expressions:

```tsx
const name = 'Alice'
<div>Hello, {name}!</div>
```

## Event Handlers

Event handlers use the `on` prefix:

```tsx
<button onclick={() => console.log('clicked')}>
  Click me
</button>

// Compiles to
html`<button @click=${() => console.log('clicked')}>Click me</button>`
```

## Class and Style

### classList

Use the `classList` prop for conditional classes:

```tsx
<div classList={{ active: isActive, disabled: !enabled }}>
  Content
</div>

// Compiles to
html`<div class=${classMap({ active: isActive, disabled: !enabled })}>Content</div>`
```

### class

For static classes, use `class`:

```tsx
<div class="my-class">Content</div>
```

You can also use `class` with an object literal as a shorthand (automatically uses `classMap`):

```tsx
<div class={{ active: true, disabled: false }}>
  Content
</div>
```

::: tip
For variables, use `classList={myClasses}` to ensure `classMap` is always applied.
:::

### style

For inline styles, use the `style` attribute with an object (automatically uses `styleMap`):

```tsx
<div style={{ color: 'red', fontSize: '16px' }}>
  Styled content
</div>

// Compiles to
html`<div style=${styleMap({ color: 'red', fontSize: '16px' })}>Styled content</div>`
```

You can also use `styleList` for variables to ensure `styleMap` is applied:

```tsx
<div styleList={myStyles}>
  Content
</div>
```

## Children

JSX children can be text, elements, or expressions:

```tsx
<div>
  <h1>Title</h1>
  <p>{description}</p>
  {items.map(item => <li>{item}</li>)}
</div>
```

## Fragments

Use fragments to group elements without adding a wrapper:

```tsx
<>
  <h1>Title</h1>
  <p>Description</p>
</>
```

## Comments

JSX comments use the JavaScript comment syntax:

```tsx
<div>
  {/* This is a comment */}
  <p>Content</p>
</div>
```

## Self-Closing Tags

Elements without children can use self-closing syntax:

```tsx
<input type="text" />
<br />
<img src="image.jpg" alt="description" />
```

## Next Steps

- Learn about [Components](/guide/components)
- Understand [Bindings](/guide/bindings)
- Explore [Directives](/guide/directives)
