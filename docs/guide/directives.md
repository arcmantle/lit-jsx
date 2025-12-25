# Directives

Learn how to use Lit directives with lit-jsx.

## Overview

Lit directives are special values that can control how values are rendered to the DOM. lit-jsx supports all Lit directives directly.

## Using Directives

Import directives from `lit/directives/*` and use them directly:

```tsx
import { until } from 'lit/directives/until.js'
import { when } from 'lit/directives/when.js'

function MyComponent() {
  const asyncData = fetchData()

  return (
    <div>
      {until(asyncData, <div>Loading...</div>)}
    </div>
  )
}
```

## Common Directives

### until

Display fallback content while waiting for a promise:

```tsx
import { until } from 'lit/directives/until.js'

function AsyncComponent() {
  const loadUser = async () => {
    const response = await fetch('/api/user')
    const user = await response.json()
    return <div>Welcome, {user.name}!</div>
  }

  return (
    <div>
      {until(
        loadUser(),
        <div>Loading user...</div>
      )}
    </div>
  )
}
```

### when

Conditionally render content:

```tsx
import { when } from 'lit/directives/when.js'

function ConditionalContent({ showDetails, summary, details }) {
  return (
    <div>
      <div>{summary}</div>
      {when(
        showDetails,
        () => <div class="details">{details}</div>,
        () => <button>Show Details</button>
      )}
    </div>
  )
}
```

### repeat

Efficiently render lists with keys:

```tsx
import { repeat } from 'lit/directives/repeat.js'

function TodoList({ todos }) {
  return (
    <ul>
      {repeat(
        todos,
        (todo) => todo.id,
        (todo) => <li>{todo.text}</li>
      )}
    </ul>
  )
}
```

### ref

Get a reference to a DOM element:

```tsx
import { ref, createRef } from 'lit/directives/ref.js'

function VideoPlayer() {
  const videoRef = createRef()

  const play = () => {
    videoRef.value?.play()
  }

  const pause = () => {
    videoRef.value?.pause()
  }

  return (
    <div>
      <video ref={ref(videoRef)} src="video.mp4" />
      <button onclick={play}>Play</button>
      <button onclick={pause}>Pause</button>
    </div>
  )
}
```

### cache

Cache DOM for expensive re-renders:

```tsx
import { cache } from 'lit/directives/cache.js'

function TabPanel({ activeTab }) {
  return (
    <div>
      {cache(
        activeTab === 'home' ? <HomePage /> :
        activeTab === 'profile' ? <ProfilePage /> :
        activeTab === 'settings' ? <SettingsPage /> :
        <NotFound />
      )}
    </div>
  )
}
```

### live

Ensure value stays in sync with live DOM state:

```tsx
import { live } from 'lit/directives/live.js'

function LiveInput({ value }) {
  return (
    <input
      type="text"
      value={live(value)}
    />
  )
}
```

### ifDefined

Only set attribute if value is defined:

```tsx
import { ifDefined } from 'lit/directives/if-defined.js'

function OptionalAttributes({ id, title }) {
  return (
    <div
      id={ifDefined(id)}
      title={ifDefined(title)}
    >
      Content
    </div>
  )
}
```

### guard

Only re-evaluate when dependencies change:

```tsx
import { guard } from 'lit/directives/guard.js'

function ExpensiveRender({ data }) {
  const expensiveTransform = (data) => {
    // Complex computation
    return processData(data)
  }

  return (
    <div>
      {guard([data], () => (
        <div>{expensiveTransform(data)}</div>
      ))}
    </div>
  )
}
```

### unsafeHTML

Render raw HTML (use with caution):

```tsx
import { unsafeHTML } from 'lit/directives/unsafe-html.js'

function RawHTML({ htmlString }) {
  return (
    <div>
      {unsafeHTML(htmlString)}
    </div>
  )
}
```

### unsafeSVG

Render raw SVG:

```tsx
import { unsafeSVG } from 'lit/directives/unsafe-svg.js'

function SVGIcon({ svgString }) {
  return (
    <div>
      {unsafeSVG(svgString)}
    </div>
  )
}
```

## Built-in Directive Support

Some directives are automatically used by lit-jsx:

### classMap

Automatically used with `classList` or when `class` receives an object literal:

```tsx
// Using classList (recommended for variables)
<div classList={{ active: true, disabled: false }}>

// Or using class with object literal (shorthand)
<div class={{ active: true, disabled: false }}>

// Both automatically use classMap directive
import { classMap } from 'lit/directives/class-map.js'
html`<div class=${classMap({ active: true, disabled: false })}>`
```

### styleMap

Automatically used with `styleList` or when `style` receives an object literal:

```tsx
// Using styleList (recommended for variables)
<div styleList={{ color: 'red', fontSize: '16px' }}>

// Or using style with object literal (shorthand)
<div style={{ color: 'red', fontSize: '16px' }}>

// Both automatically use styleMap directive
import { styleMap } from 'lit/directives/style-map.js'
html`<div style=${styleMap({ color: 'red', fontSize: '16px' })}>`

// Automatically uses styleMap directive
import { styleMap } from 'lit/directives/style-map.js'
html`<div style=${styleMap({ color: 'red', fontSize: '16px' })}>`
```

## Creating Custom Directives

You can create your own directives and use them with lit-jsx:

```tsx
import { directive, Directive } from 'lit/directive.js'

class HighlightDirective extends Directive {
  render(text: string, searchTerm: string) {
    const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === searchTerm.toLowerCase()
        ? html`<mark key=${i}>${part}</mark>`
        : part
    )
  }
}

const highlight = directive(HighlightDirective)

// Usage
function SearchResults({ text, search }) {
  return (
    <div>
      {highlight(text, search)}
    </div>
  )
}
```

## Next Steps

- Learn about the [Vite Plugin](/guide/vite-plugin)
- Explore [TypeScript](/guide/typescript) integration
- Check out the [API Reference](/api/index)
