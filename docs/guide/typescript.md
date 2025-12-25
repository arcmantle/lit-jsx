# TypeScript

Learn how to use lit-jsx with TypeScript for full type safety.

## TypeScript Configuration

Configure your `tsconfig.json` for lit-jsx:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "jsxImportSource": "@arcmantle/lit-jsx",
    "moduleResolution": "bundler",
    "strict": true,
    "types": ["vite/client"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Key Options

- `jsx: "preserve"` - Required for lit-jsx to transform JSX at build time
- `jsxImportSource: "@arcmantle/lit-jsx"` - Point to lit-jsx runtime
- `strict: true` - Enable all strict type checking

## Type-Safe Components

### Function Components

Function components are fully typed:

```tsx
interface ButtonProps {
  label: string
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
  onclick?: (event: MouseEvent) => void
}

function Button({
  label,
  variant = 'primary',
  disabled = false,
  onclick
}: ButtonProps) {
  return (
    <button
      class={`btn btn-${variant}`}
      disabled={as.bool(disabled)}
      onclick={onclick}
    >
      {label}
    </button>
  )
}

// Usage - TypeScript will catch errors
<Button label="Click me" variant="primary" />
<Button label="Delete" variant="danger" />
// @ts-expect-error - invalid variant
<Button label="Bad" variant="invalid" />
```

### LitElement Components

LitElement components maintain their types:

```tsx
import { LitElement } from 'lit'
import { customElement, property } from 'lit/decorators.js'

interface User {
  id: string
  name: string
  email: string
}

@customElement('user-card')
class UserCard extends LitElement {
  @property({ type: Object }) user!: User

  render() {
    return (
      <div class="user-card">
        <h3>{this.user.name}</h3>
        <p>{this.user.email}</p>
      </div>
    )
  }
}

// TypeScript knows the props
declare global {
  interface HTMLElementTagNameMap {
    'user-card': UserCard
  }
}

// Usage is type-safe
<user-card user={as.prop({ id: '1', name: 'Alice', email: 'alice@example.com' })} />
```

## DOM Types

All HTML elements have proper DOM types:

```tsx
function Form() {
  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const formData = new FormData(form)
    // TypeScript knows all FormData methods
    console.log(formData.get('username'))
  }

  const handleInput = (e: InputEvent) => {
    const input = e.target as HTMLInputElement
    // TypeScript knows HTMLInputElement properties
    console.log(input.value)
  }

  return (
    <form onsubmit={handleSubmit}>
      <input type="text" name="username" oninput={handleInput} />
      <button type="submit">Submit</button>
    </form>
  )
}
```

## Event Handler Types

Event handlers are fully typed based on the element:

```tsx
function EventExamples() {
  // MouseEvent for click
  const handleClick = (e: MouseEvent) => {
    console.log(e.clientX, e.clientY)
  }

  // InputEvent for input
  const handleInput = (e: InputEvent) => {
    const target = e.target as HTMLInputElement
    console.log(target.value)
  }

  // KeyboardEvent for keydown/keyup
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      console.log('Enter pressed')
    }
  }

  // FocusEvent for focus/blur
  const handleFocus = (e: FocusEvent) => {
    const target = e.target as HTMLElement
    target.classList.add('focused')
  }

  return (
    <>
      <button onclick={handleClick}>Click</button>
      <input oninput={handleInput} onkeydown={handleKeyDown} onfocus={handleFocus} />
    </>
  )
}
```

## Generic Components

Create reusable generic components:

```tsx
interface SelectProps<T> {
  options: T[]
  value?: T
  getLabel: (option: T) => string
  getValue: (option: T) => string
  onchange?: (value: T) => void
}

function Select<T>({
  options,
  value,
  getLabel,
  getValue,
  onchange
}: SelectProps<T>) {
  const handleChange = (e: Event) => {
    const select = e.target as HTMLSelectElement
    const selectedValue = select.value
    const option = options.find(o => getValue(o) === selectedValue)
    if (option && onchange) {
      onchange(option)
    }
  }

  return (
    <select onchange={handleChange}>
      {options.map(option => (
        <option
          value={getValue(option)}
          selected={value === option}
        >
          {getLabel(option)}
        </option>
      ))}
    </select>
  )
}

// Usage with type inference
interface Color {
  name: string
  hex: string
}

const colors: Color[] = [
  { name: 'Red', hex: '#ff0000' },
  { name: 'Green', hex: '#00ff00' },
  { name: 'Blue', hex: '#0000ff' },
]

<Select
  options={colors}
  getLabel={c => c.name}
  getValue={c => c.hex}
  onchange={color => console.log(color.name)}
/>
```

## Type Inference

TypeScript can infer types in many cases:

```tsx
// Props type is inferred
function Greeting({ name, age = 0 }) {
  return <div>Hello {name}, you are {age}</div>
}

// Event type is inferred from the element
<button onclick={(e) => {
  // e is inferred as MouseEvent
  console.log(e.clientX)
}}>
  Click
</button>

// Map callback type is inferred
const items = ['a', 'b', 'c']
{items.map(item => {
  // item is inferred as string
  return <li>{item.toUpperCase()}</li>
})}
```

## Type Utilities

lit-jsx provides type utilities for common patterns:

```tsx
import type { JSX } from '@arcmantle/lit-jsx/jsx-runtime'

// Get element type from tag name
type DivElement = JSX.IntrinsicElements['div']

// Get all valid HTML tag names
type HTMLTags = keyof JSX.IntrinsicElements

// Component props type
type ComponentProps<T> = T extends (props: infer P) => any ? P : never

function Button(props: { label: string }) {
  return <button>{props.label}</button>
}

type ButtonProps = ComponentProps<typeof Button>
// ButtonProps is { label: string }
```

## Strict Null Checks

With strict null checks enabled, TypeScript will catch potential null/undefined issues:

```tsx
interface UserProps {
  user?: User
}

function UserProfile({ user }: UserProps) {
  // TypeScript error: user might be undefined
  // return <div>{user.name}</div>

  // Correct: check for undefined
  return (
    <div>
      {user ? <div>{user.name}</div> : <div>No user</div>}
    </div>
  )
}
```

## Type-Safe Refs

Refs are fully typed:

```tsx
import { createRef, ref } from 'lit/directives/ref.js'
import type { Ref } from 'lit/directives/ref.js'

function VideoPlayer() {
  const videoRef: Ref<HTMLVideoElement> = createRef()

  const play = () => {
    // TypeScript knows videoRef.value is HTMLVideoElement | undefined
    videoRef.value?.play()
    // TypeScript error: Property 'pause' exists on type 'HTMLVideoElement'
    // videoRef.value?.invalidMethod()
  }

  return (
    <div>
      <video ref={ref(videoRef)} src="video.mp4" />
      <button onclick={play}>Play</button>
    </div>
  )
}
```

## Custom Element Types

Define custom element types using the standard `HTMLElementTagNameMap`:

```tsx
declare global {
  interface HTMLElementTagNameMap {
    'my-custom-element': MyCustomElement
  }
}

// Define your element class
class MyCustomElement extends HTMLElement {
  name?: string
  count?: number

  // Custom event handling
  addEventListener(
    type: 'change',
    listener: (this: MyCustomElement, ev: CustomEvent) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void
  addEventListener(type: any, listener: any, options?: any): void {
    super.addEventListener(type, listener, options)
  }
}

// Now my-custom-element is type-safe
<my-custom-element
  name="test"
  count={as.prop(42)}
  onchange={(e) => console.log(e.detail)}
/>
```

This is the standard TypeScript approach for typing custom elements and provides better IDE support.

## Next Steps

- Learn about [Performance](/guide/performance) optimization
- Check out the [API Reference](/api/index)
- Explore the source code on [GitHub](https://github.com/arcmantle/lit-jsx)
