# Vite Plugin

Learn how to configure the lit-jsx Vite plugin.

## Installation

The Vite plugin is included with the lit-jsx package:

```ts
import { litJsx } from '@arcmantle/lit-jsx/vite'
```

## Basic Configuration

Add the plugin to your `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import { litJsx } from '@arcmantle/lit-jsx/vite'

export default defineConfig({
  plugins: [litJsx()],
})
```

## Plugin Options

The plugin accepts several configuration options:

```ts
interface LitJsxPluginOptions {
  // Enable legacy decorators support
  legacyDecorators?: boolean

  // Enables support for experimental compiled templates (default: true)
  useCompiledTemplates?: boolean

  // Opts into automatic discovery of custom elements instead of using the static attribute
  useImportDiscovery?: boolean

  // Enable debug mode for additional logging
  debug?: boolean

  // Options for the Babel transform
  babel?:
    | babel.TransformOptions
    | ((code: string, id: string) => babel.TransformOptions | Promise<babel.TransformOptions>)
}
```

### Example with Options

```ts
import { defineConfig } from 'vite'
import { litJsx } from '@arcmantle/lit-jsx/vite'

export default defineConfig({
  plugins: [
    litJsx({
      useCompiledTemplates: true,
      useImportDiscovery: true,
      debug: process.env.DEBUG === 'true',
      legacyDecorators: false,
      babel: {
        // Additional Babel options if needed
        plugins: [],
      },
    }),
  ],
})
```

## Compiled Templates

By default, the plugin uses compiled templates for optimal performance:

```ts
litJsx({
  // Compiled templates are enabled by default
  useCompiledTemplates: true,
})
```

Compiled templates provide:
- Better performance at runtime
- Smaller bundle sizes
- Static analysis optimizations

You can disable them if needed:

```ts
litJsx({
  useCompiledTemplates: false,
})
```

## Import Discovery

Enable automatic discovery of custom elements:

```ts
litJsx({
  useImportDiscovery: true,
})
```

When enabled, the plugin automatically detects custom elements from imports, eliminating the need for the `static` attribute on component classes.

## Legacy Decorators

If you're using legacy decorators:

```ts
litJsx({
  legacyDecorators: true,
})
```

## Debug Mode

Enable debug logging to see transformation details:

```ts
litJsx({
  debug: true,
})
```

Debug mode provides:
- Detailed transformation logs
- Processing information
- Helpful for troubleshooting

## Custom Babel Configuration

You can provide custom Babel options:

```ts
litJsx({
  babel: {
    plugins: [
      // Additional Babel plugins
    ],
    // Other Babel options
  },
})
```

Or use a function for dynamic configuration:

```ts
litJsx({
  babel: (code, id) => {
    return {
      plugins: id.includes('test') ? [] : ['some-plugin'],
    }
  },
})
```

## TypeScript Integration

The plugin works seamlessly with TypeScript. Ensure your `tsconfig.json` is configured:

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "@arcmantle/lit-jsx",
    "types": ["vite/client"]
  }
}
```

## HMR (Hot Module Replacement)

The plugin includes HMR support that invalidates the module graph when JSX files change. However, due to the nature of web components and custom elements, **changes require a full page reload** to properly re-register custom elements and update the component definitions.

## Build Optimization

The plugin optimizes the output during build:

- Removes runtime JSX transform overhead
- Generates static Lit templates
- Tree-shakes unused code
- Minifies output

## Complete Configuration Example

Here's a complete example with all options:

```ts
import { defineConfig } from 'vite'
import { litJsx } from '@arcmantle/lit-jsx/vite'

export default defineConfig({
  plugins: [
    litJsx({
      useCompiledTemplates: true,
      useImportDiscovery: true,
      debug: process.env.DEBUG === 'true',
      legacyDecorators: false,
      babel: {
        // Custom Babel options if needed
      },
    }),
  ],
})
```

## Troubleshooting

### JSX Not Transforming

The plugin automatically processes `.jsx` and `.tsx` files. Ensure:
- Your file has the correct extension
- JSX syntax is present in the file (the plugin filters by `/>` and `</` in the code)

### Type Errors

Make sure TypeScript is configured correctly:

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "@arcmantle/lit-jsx"
  }
}
```

### Custom Elements Not Detected

If custom elements aren't being recognized, try enabling import discovery:

```ts
litJsx({
  useImportDiscovery: true,
})
```

## Next Steps

- Learn about [TypeScript](/guide/typescript) integration
- Explore [Performance](/guide/performance) optimization
- Check out the [API Reference](/api/index)
