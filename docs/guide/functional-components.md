# Functional Components

Functional components are simple functions that return JSX. They are stateless and re-render whenever their parent re-renders.

## Basic Functional Component

A functional component is just a function that returns JSX:

```tsx
function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}!</h1>
}

// Usage
<Greeting name="Alice" />
```

## With TypeScript Props

Define props using TypeScript interfaces:

```tsx
interface GreetingProps {
  name: string
  age?: number
}

function Greeting({ name, age }: GreetingProps) {
  return (
    <div>
      <h1>Hello, {name}!</h1>
      {age && <p>You are {age} years old.</p>}
    </div>
  )
}

// Usage
<Greeting name="Alice" age={30} />
```

## Generic Functional Components

Use TypeScript generics for type-safe, reusable components:

```tsx
interface ListProps<T> {
  items: T[]
  renderItem: (item: T) => JSX.Element
}

function List<T>({ items, renderItem }: ListProps<T>) {
  return (
    <ul>
      {items.map((item, index) => (
        <li key={index}>{renderItem(item)}</li>
      ))}
    </ul>
  )
}

// Usage - TypeScript infers the type
<List
  items={users}
  renderItem={user => <span>{user.name}</span>}
/>

// Explicit type parameter
<List<User>
  items={users}
  renderItem={user => <span>{user.name}</span>}
/>
```

### Generic Component with Constraints

```tsx
interface Entity {
  id: string
  name: string
}

interface EntityListProps<T extends Entity> {
  items: T[]
  onSelect?: (item: T) => void
}

function EntityList<T extends Entity>({ items, onSelect }: EntityListProps<T>) {
  return (
    <ul>
      {items.map(item => (
        <li key={item.id} onclick={() => onSelect?.(item)}>
          {item.name}
        </li>
      ))}
    </ul>
  )
}
```

## Component Composition

Compose functional components together:

```tsx
function UserCard({ user }: { user: User }) {
  return (
    <div class="card">
      <Avatar url={user.avatarUrl} />
      <UserInfo name={user.name} email={user.email} />
    </div>
  )
}

function Avatar({ url }: { url: string }) {
  return <img src={url} alt="Avatar" class="avatar" />
}

function UserInfo({ name, email }: { name: string; email: string }) {
  return (
    <div>
      <h3>{name}</h3>
      <p>{email}</p>
    </div>
  )
}
```

## Conditional Rendering

Use JavaScript expressions for conditional rendering:

```tsx
function Message({ type, text }: { type: 'error' | 'success'; text: string }) {
  return (
    <div>
      {type === 'error' && <ErrorIcon />}
      {type === 'success' && <SuccessIcon />}
      <span>{text}</span>
    </div>
  )
}

// Or use ternary operators
function Status({ isOnline }: { isOnline: boolean }) {
  return (
    <div>
      {isOnline ? (
        <span class="online">Online</span>
      ) : (
        <span class="offline">Offline</span>
      )}
    </div>
  )
}
```

## Lists and Iteration

Map over arrays to render lists:

```tsx
interface Todo {
  id: string
  text: string
  completed: boolean
}

function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>
          <TodoItem todo={todo} />
        </li>
      ))}
    </ul>
  )
}

function TodoItem({ todo }: { todo: Todo }) {
  return (
    <div classList={{ completed: todo.completed }}>
      <input type="checkbox" checked={as.prop(todo.completed)} />
      <span>{todo.text}</span>
    </div>
  )
}
```

## Children Prop

Access children through the props:

```tsx
interface CardProps {
  title: string
  children: any
}

function Card({ title, children }: CardProps) {
  return (
    <div class="card">
      <h2>{title}</h2>
      <div class="card-body">
        {children}
      </div>
    </div>
  )
}

// Usage
<Card title="My Card">
  <p>This is the card content</p>
  <button>Action</button>
</Card>
```

## Default Props

Use default parameter values for optional props:

```tsx
interface ButtonProps {
  label: string
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  onclick?: () => void
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
```

## When to Use Functional Components

Use functional components when:

- You need simple, stateless rendering
- You want to compose UI from smaller pieces
- You don't need lifecycle methods or reactive properties
- You're creating reusable utility components

For stateful components with reactivity, use [Custom Elements](/guide/custom-elements).

## Next Steps

- Learn about [Custom Elements](/guide/custom-elements)
- Explore [Bindings](/guide/bindings)
- Check out [Directives](/guide/directives)
