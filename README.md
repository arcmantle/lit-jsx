# lit-jsx

A powerful JSX compiler and Vite plugin that transforms JSX into native Lit templates at compile time with zero runtime overhead.

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

### Custom Element Identification

lit-jsx needs to know which elements are custom elements to compile them correctly. Custom elements must be identified using the `static` attribute:

```tsx
// ✅ Custom elements - requires static attribute
<my-custom-element static prop={as.prop(value)}>Content</my-custom-element>
<MyButton static onclick={handleClick}>Click me</MyButton>

// ✅ Regular HTML elements - no static attribute needed
<div class="container">
  <button onclick={handleClick}>Regular button</button>
</div>
```

**Alternative**: Enable automatic import discovery by setting `useImportDiscovery: true` in your Vite config to restore the previous behavior where the compiler automatically detects custom elements.

### Attribute Binding Control

lit-jsx provides precise control over how values are bound to elements:

#### Default Behavior (Attribute Binding)

```tsx
<input value={userInput} />
// Compiles to: <input value=${userInput} />
```

#### Property Binding

```tsx
<input value={as.prop(userInput)} />
// Compiles to: <input .value=${userInput} />
```

#### Boolean Attribute Binding

```tsx
<input disabled={as.bool(isDisabled)} />
// Compiles to: <input ?disabled=${isDisabled} />
```

### Special Attributes

#### classList - Object to Class Mapping

```tsx
<div classList={{ active: isActive, disabled: !isEnabled }}>
// Compiles to: <div class=${classMap({ active: isActive, disabled: !isEnabled })}>
```

#### styleList - Object to Style Mapping

```tsx
<div styleList={{ color: textColor, fontSize: '16px' }}>
// Compiles to: <div style=${styleMap({ color: textColor, fontSize: '16px' })}>
```

#### Event Handlers

Event handlers use standard React-style `onevent` syntax with lowercase event names:

```tsx
<button onclick={handleClick} ondblclick={handleDoubleClick}>
// Compiles to: <button @click=${handleClick} @dblclick=${handleDoubleClick}>
```

Common event handlers include `onclick`, `onchange`, `onsubmit`, `onkeydown`, `onmouseover`, etc.

#### References

```tsx
<input ref={inputRef} />
// Compiles to: <input ${ref(inputRef)} />
```

#### Element Directives

```tsx
<div directive={myDirective()} />
// Compiles to: <div ${myDirective()} />

// Multiple directives as an array
<div directive={[directive1(), directive2()]} />
// Compiles to: <div ${directive1()} ${directive2()} />
```

#### Spread Attributes

```tsx
<div {...dynamicProps} />
// Compiles to: <div ${__$rest(dynamicProps)} />
```

## 🏗️ Component Patterns

### Function Components

lit-jsx fully supports function components that return JSX:

```tsx
const Button = ({ label, variant = 'primary', disabled, onclick, children }) => (
  <button
    classList={{ [`btn-${variant}`]: true, 'disabled': disabled }}
    disabled={as.bool(disabled)}
    onclick={onclick}
  >
    {label || children}
  </button>
);

// Usage
<Button
  label="Submit"
  variant="success"
  onclick={handleSubmit}
  disabled={as.bool(isLoading)}
/>
```

Function components:

- Receive props as a single object parameter
- Support `children` via the `children` property
- Compile to efficient function calls
- Support all JSX features including conditional rendering and loops

### Custom Element Integration

lit-jsx provides full type-safe integration with custom elements. You can use LitElement classes directly in JSX:

```tsx
import { LitElement } from 'lit';

export class MyButton extends LitElement {
  static tagName = 'my-button';

  render() {
    return html`<button><slot></slot></button>`;
  }
}

// Usage - use the class directly with the static attribute
<MyButton
  static
  class="custom-btn"
  onclick={() => console.log('Clicked!')}
/>
```

#### Generic Custom Elements

lit-jsx provides automatic support for generic custom element classes with full type safety:

```tsx
import { LitElement } from 'lit';

class DataList<T> extends LitElement {
  static tagName = 'data-list';

  @property({ type: Array }) items: T[] = [];
  @property() renderItem?: (item: T) => TemplateResult;

  render() {
    return html`
      <ul>
        ${this.items.map(item => html`
          <li>${this.renderItem ? this.renderItem(item) : item}</li>
        `)}
      </ul>
    `;
  }
}

// ✅ Use the class directly with type parameters - generics work automatically!
<DataList<User>
  static
  items={as.prop(users)}
  renderItem={as.prop((user) => `${user.name} (${user.email})`)}
/>

// Type inference works perfectly for the renderItem callback
<DataList<Product>
  static
  items={as.prop(products)}
  renderItem={as.prop((product) => `${product.name} - $${product.price}`)}
/>
```

**Note**: Generic type parameters are automatically preserved when using classes directly in JSX. No manual type annotations needed!

#### Parameter Typing for Custom Elements

When writing functions that accept custom element classes as parameters, use proper TypeScript typing:

```tsx
import { LitElement } from 'lit';

// ✅ Using the class constructor type directly
function renderWithWrapper<T extends typeof LitElement>(
  Component: T
) {
  return ({ children, ...props }) => (
    <div class="wrapper">
      <Component static {...props}>{children}</Component>
    </div>
  );
}

// ✅ Using specific class types
function createEnhancer(Component: typeof MyButton) {
  return ({ enhanced, ...props }) => (
    <div class={enhanced ? 'enhanced' : ''}>
      <Component static {...props} />
    </div>
  );
}

// ❌ This won't work - compiler can't detect the custom element
function renderComponent(Component: any) {
  return <Component>Content</Component>; // Error: Component not recognized
}
```

**Important**: Proper typing allows the compiler to recognize custom elements and apply the correct transformations.

### Dynamic Tag Names

lit-jsx supports dynamic element types using the `as.tag()` helper:

```tsx
function ActionElement({ href, children }) {
  const Tag = as.tag(href ? 'a' : 'button');

  return (
    <Tag static href={href} class="action-element">
      {children}
    </Tag>
  );
}
```

The `as.tag()` helper signals to the compiler that this is a dynamic tag, allowing it to optimize the template using Lit's static templates.

```tsx
function DynamicElement({ useDiv, children }) {
  const Tag = as.tag(useDiv ? 'div' : 'span');

  return <Tag static>{children}</Tag>;
}
```### Library Components

lit-jsx provides utility components that enhance common patterns and integrate seamlessly with Lit directives:

#### For Component - Declarative List Rendering

The `For` component provides a declarative way to render lists with optional keys and separators:

```tsx
import { For } from '@arcmantle/lit-jsx';

// Basic list rendering
<For each={users}>
  {(user, index) => (
    <div class="user-item">
      {index + 1}. {user.name}
    </div>
  )}
</For>

// With key function for efficient updates
<For each={todos} key={(todo) => todo.id}>
  {(todo, index) => (
    <li classList={{ completed: todo.completed }}>
      {todo.text}
    </li>
  )}
</For>

// With separators between items
<For each={breadcrumbs} separator={<span> / </span>}>
  {(crumb, index) => (
    <a href={crumb.url}>{crumb.label}</a>
  )}
</For>
```

The `For` component automatically uses lit-html's optimized directives:

- **Without key**: Uses `map` directive for simple iteration
- **With key**: Uses `repeat` directive for efficient updates when items change
- **With separator**: Uses `join` directive to insert elements between items

#### Show Component - Conditional Rendering

The `Show` component provides type-safe conditional rendering with optional fallback:

```tsx
import { Show } from '@arcmantle/lit-jsx';

// Simple conditional rendering
<Show when={user}>
  {(user) => (
    <div class="welcome">
      Welcome back, {user.name}!
    </div>
  )}
</Show>

// With fallback content
<Show when={currentUser}>
  {[
    (user) => (
      <div class="user-panel">
        <img src={user.avatar} alt={user.name} />
        <span>{user.name}</span>
      </div>
    ),
    () => (
      <div class="login-prompt">
        <button>Sign In</button>
      </div>
    )
  ]}
</Show>

// Conditional rendering with complex conditions
<Show when={items.length > 0}>
  {(length) => (
    <div class="item-count">
      Found {length} items
    </div>
  )}
</Show>
```

The `Show` component uses lit-html's `when` directive internally and provides strong TypeScript inference for the truthy value.

#### Choose Component - Multi-Condition Rendering

The `Choose` component enables clean switch-like conditional rendering with multiple condition-output pairs:

```tsx
import { Choose } from '@arcmantle/lit-jsx';

// Multiple conditions based on a value
<Choose value={status}>
  {[
    (status) => status === 'loading',
    () => (
      <div class="loading">
        <spinner-icon static></spinner-icon>
        Loading...
      </div>
    )
  ]}
  {[
    (status) => status === 'error',
    (status) => (
      <div class="error">
        Error: {status}
      </div>
    )
  ]}
  {[
    (status) => status === 'success',
    (status) => (
      <div class="success">
        Operation completed successfully!
      </div>
    )
  ]}
  {[
    () => true, // Default case
    (status) => (
      <div class="unknown">
        Unknown status: {status}
      </div>
    )
  ]}
</Choose>

// Without a value (boolean conditions)
<Choose>
  {[
    () => user.isAdmin,
    () => <admin-panel static></admin-panel>
  ]}
  {[
    () => user.isModerator,
    () => <moderator-panel static></moderator-panel>
  ]}
  {[
    () => true, // Default case
    () => <user-panel static></user-panel>
  ]}
</Choose>
```

The `Choose` component evaluates conditions in order and renders the first matching case, similar to a switch statement but as an expression.

#### Combining Library Components

These components work seamlessly together for complex rendering scenarios:

```tsx
import { For, Show, Choose } from '@arcmantle/lit-jsx';

@customElement('user-dashboard')
export class UserDashboard extends LitElement {
  @property({ type: Array }) users = [];
  @property() currentUser = null;
  @property() viewMode = 'list';

  render() {
    return (
      <div class="dashboard">
        {/* Conditional user greeting */}
        <Show when={this.currentUser}>
          {(user) => (
            <header class="welcome">
              Welcome back, {user.name}!
            </header>
          )}
        </Show>

        {/* Dynamic view rendering based on mode */}
        <Choose value={this.viewMode}>
          {[
            (mode) => mode === 'grid',
            () => (
              <div class="user-grid">
                <For each={this.users} key={(user) => user.id}>
                  {(user) => (
                    <div class="user-card">
                      <img src={user.avatar} alt={user.name} />
                      <h3>{user.name}</h3>
                      <p>{user.role}</p>
                    </div>
                  )}
                </For>
              </div>
            )
          ]}
          {[
            (mode) => mode === 'list',
            () => (
              <div class="user-list">
                <For each={this.users} separator={<hr />}>
                  {(user, index) => (
                    <div class="user-row">
                      <span class="user-index">{index + 1}.</span>
                      <span class="user-name">{user.name}</span>
                      <span class="user-role">{user.role}</span>
                    </div>
                  )}
                </For>
              </div>
            )
          ]}
          {[
            () => true, // Default case
            (mode) => (
              <div class="error">
                Unknown view mode: {mode}
              </div>
            )
          ]}
        </Choose>

        {/* Conditional empty state */}
        <Show when={this.users.length === 0}>
          {() => (
            <div class="empty-state">
              <p>No users found</p>
              <button onclick={this.loadUsers}>Load Users</button>
            </div>
          )}
        </Show>
      </div>
    );
  }
}
```

## 🔧 Advanced Usage

### Lit Directives Integration

lit-jsx works seamlessly with all Lit directives:

```tsx
import { when } from 'lit-html/directives/when.js';
import { repeat } from 'lit-html/directives/repeat.js';
import { guard } from 'lit-html/directives/guard.js';

return (
  <div>
    {when(condition, () => <p>Conditional content</p>)}
    {repeat(items, item => item.id, item => (
      <li key={item.id}>{item.name}</li>
    ))}
    {guard([expensiveData], () => (
      <ExpensiveComponent data={expensiveData} />
    ))}
  </div>
);
```

### Complex Example: Todo List

```tsx
@customElement('todo-list')
export class TodoList extends LitElement {
  @property({ type: Array }) items = [];
  @state() private newItemText = '';
  @state() private filter = 'all';

  private inputRef = createRef();

  get filteredItems() {
    switch (this.filter) {
      case 'active': return this.items.filter(item => !item.completed);
      case 'completed': return this.items.filter(item => item.completed);
      default: return this.items;
    }
  }

  addItem() {
    if (this.newItemText.trim()) {
      this.items = [...this.items, {
        id: Date.now(),
        text: this.newItemText,
        completed: false
      }];
      this.newItemText = '';
      this.inputRef.value?.focus();
    }
  }

  render() {
    return (
      <div class="todo-container">
        <h1>Todo List</h1>

        <div class="add-form">
          <input
            ref={this.inputRef}
            value={as.prop(this.newItemText)}
            placeholder="Add new todo..."
            oninput={(e) => this.newItemText = e.target.value}
            onkeydown={(e) => e.key === 'Enter' && this.addItem()}
          />
          <button onclick={this.addItem}>Add</button>
        </div>

        <div class="filters">
          {['all', 'active', 'completed'].map(filterType => (
            <button
              classList={{ active: this.filter === filterType }}
              onclick={() => this.filter = filterType}
            >
              {filterType}
            </button>
          ))}
        </div>

        {when(this.filteredItems.length > 0, () => (
          <ul class="todo-list">
            {repeat(this.filteredItems, item => item.id, item => (
              <TodoItem
                todo={item}
                onToggle={(id) => this.toggleItem(id)}
                onDelete={(id) => this.deleteItem(id)}
              />
            ))}
          </ul>
        ), () => (
          <p class="empty-state">No items to show</p>
        ))}
      </div>
    );
  }
}
```

## 🎛️ Configuration

### Vite Plugin Options

```typescript
import { litJsx } from '@arcmantle/lit-jsx/vite';

export default defineConfig({
  plugins: [
    litJsx({
      legacyDecorators: true,
      useCompiledTemplates: true, // Default: true - enables compiled templates for better performance
      useImportDiscovery: false,  // Default: false - when false, requires 'static' attribute for custom elements
    }),
  ],
});
```

### Breaking Changes in v1.0.33

#### Import Discovery Now Opt-In

Starting in v1.0.33, import discovery is disabled by default. This means:

- **New default behavior**: Custom elements and dynamic tags must be identified using the `static` attribute
- **Previous behavior**: Can be restored by setting `useImportDiscovery: true` in the plugin options

**Why this change?** The static attribute approach provides better performance, more predictable compilation, and clearer intent in your JSX code.

#### Using the Static Attribute

The `static` attribute tells the compiler that an element is a custom element or dynamic tag:

```tsx
// ✅ Using static attribute for custom elements
<MyButton static>Click me</MyButton>
<MyCustomElement static prop={as.prop(value)}>Content</MyCustomElement>

// ✅ For dynamic tags with as.tag()
const Tag = as.tag(href ? 'a' : 'button');
<Tag static href={href}>Dynamic element</Tag>

// ❌ Without static attribute - treated as regular HTML element
<MyButton>Click me</MyButton>

// ✅ To restore old behavior, enable import discovery
// vite.config.ts: litJsx({ useImportDiscovery: true })
```

#### Compiled Templates Default

Compiled templates are now enabled by default (`useCompiledTemplates: true`) for better performance. The compiler intelligently skips static compilation when children contain dynamic expressions that aren't statically known to be JSX elements.

## 🚀 Template Types

lit-jsx automatically detects and uses the appropriate template type:

- **HTML templates**: `html\`...\`` for regular HTML elements
- **SVG templates**: `svg\`...\`` for SVG elements
- **MathML templates**: `mathml\`...\`` for MathML elements
- **Static templates**: `htmlStatic\`...\`` for dynamic tag names

## 🎯 Best Practices

### When to Use Each Binding Type

#### **Attribute Binding (Default)**

- Custom attributes and data attributes
- Values that should appear in HTML as attributes
- Working with libraries that expect attributes

```tsx
<div data-id={item.id} aria-label={item.description} />
```

#### **Property Binding (`as.prop()`)**

- Standard DOM properties like `value`, `checked`, `selected`
- Interactive elements that need live property updates
- Complex object values

```tsx
<input value={as.prop(formData.email)} checked={as.prop(isSelected)} />
```

#### **Boolean Attribute Binding (`as.bool()`)**

- Boolean HTML attributes like `disabled`, `hidden`, `readonly`
- Accessibility attributes that follow boolean patterns
- Presence/absence semantics

```tsx
<button disabled={as.bool(isLoading)} hidden={as.bool(!isVisible)} />
```

### Function Component Guidelines

- Use descriptive prop names and provide defaults where appropriate
- Keep components focused and composable
- Leverage TypeScript for better developer experience
- Handle `children` appropriately for flexible composition

### Dynamic Tag Best Practices

- Always use `as.tag()` to define your dynamic tags
- Use descriptive variable names for clarity
- Consider TypeScript for better type safety with HTML elements
- Document complex dynamic tag logic

## 🔗 Ecosystem Integration

lit-jsx is designed to work seamlessly with the entire Lit ecosystem:

- **Lit Elements**: Full compatibility with LitElement and reactive properties
- **Lit Directives**: All official and community directives work out of the box
- **Custom Elements**: Easy integration with any custom elements
- **Web Components**: Standard web component patterns and lifecycle
- **TypeScript**: Leverages native browser type definitions (`lib.dom.d.ts`) for accurate type checking and exceptional IntelliSense support

## 📚 Migration Guide

### Migrating from Earlier Versions

If you're upgrading from v1.0.33 or earlier, please check the [CHANGELOG](./CHANGELOG.md) for breaking changes and migration instructions. Key changes include:

- **v1.0.34**: Event handlers now use React-style syntax (`onclick` instead of `on-click`)
- **v1.0.33**: Custom elements require the `static` attribute for identification

### Coming from React

lit-jsx uses familiar JSX syntax with native DOM attribute names:

```tsx
// React
<button onClick={handler} className="btn" disabled={true} />

// lit-jsx
<button onclick={handler} class="btn" disabled={as.bool(true)} />
```

Key differences:

- Event handlers: `onclick`, `onchange`, etc. (lowercase, no camelCase)
- Class attribute: `class` instead of `className`
- Boolean attributes: Use `as.bool()` for proper binding
- Property binding: Use `as.prop()` for DOM properties

### Coming from Lit html Templates

lit-jsx provides a more intuitive syntax for Lit templates:

```tsx
// Lit html
html`<div class=${classMap(classes)} @click=${handler}>${content}</div>`

// lit-jsx
<div classList={classes} onclick={handler}>{content}</div>
```

Benefits:

- Familiar JSX syntax with better IDE support
- Type-safe components and props
- Cleaner, more readable code
- Full access to all Lit features and directives

## 🤝 Contributing

Contributions, issues or requests are welcome!

## 📄 License

Apache-2.0

..
