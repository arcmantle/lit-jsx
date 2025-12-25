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
interface LitJsxOptions {
  // File patterns to include (default: /\.(tsx|jsx)$/)
  include?: RegExp | RegExp[]

  // File patterns to exclude (default: /node_modules/)
  exclude?: RegExp | RegExp[]

  // Enable debug logging
  debug?: boolean

  // Custom transformer options
  transformer?: {
    // Import source for JSX runtime
    importSource?: string

    // Enable development mode
    development?: boolean
  }
}
```

### Example with Options

```ts
import { defineConfig } from 'vite'
import { litJsx } from '@arcmantle/lit-jsx/vite'

export default defineConfig({
  plugins: [
    litJsx({
      include: /\.(tsx|jsx)$/,
      exclude: [/node_modules/, /\.test\.tsx$/],
      debug: process.env.DEBUG === 'true',
      transformer: {
        development: process.env.NODE_ENV === 'development',
      },
    }),
  ],
})
```

## File Patterns

### Include Pattern

Control which files are processed by the plugin:

```ts
litJsx({
  // Process only .tsx files
  include: /\.tsx$/,

  // Process multiple patterns
  include: [/\.tsx$/, /\.jsx$/],
})
```

### Exclude Pattern

Exclude files from processing:

```ts
litJsx({
  // Exclude node_modules and test files
  exclude: [/node_modules/, /\.test\.(tsx|jsx)$/],
})
```

## Debug Mode

Enable debug logging to see what the plugin is doing:

```ts
litJsx({
  debug: true,
})
```

This will log:

- Files being processed
- Transformation steps
- Generated code
- Performance metrics

## Development vs Production

The plugin automatically detects the environment, but you can override it:

```ts
litJsx({
  transformer: {
    development: process.env.NODE_ENV === 'development',
  },
})
```

Development mode:

- Includes source maps
- Adds additional debug information
- May skip some optimizations

Production mode:

- Optimized output
- No debug information
- Smaller bundle size

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

The plugin supports HMR out of the box. Changes to JSX files will trigger fast updates without full page reloads.

```ts
// No special configuration needed
litJsx()
```

## Build Optimization

The plugin optimizes the output during build:

- Removes runtime JSX transform overhead
- Generates static Lit templates
- Tree-shakes unused code
- Minifies output

## Multiple Configurations

You can use different configurations for different file patterns:

```ts
import { defineConfig } from 'vite'
import { litJsx } from '@arcmantle/lit-jsx/vite'

export default defineConfig({
  plugins: [
    // Main app files
    litJsx({
      include: /src\/.*\.tsx$/,
    }),

    // Test files with different settings
    litJsx({
      include: /test\/.*\.tsx$/,
      transformer: {
        development: true,
      },
    }),
  ],
})
```

## Troubleshooting

### JSX Not Transforming

Ensure your file extension matches the include pattern:

```ts
litJsx({
  include: /\.(tsx|jsx)$/,  // Matches both .tsx and .jsx
})
```

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

### Performance Issues

For large projects, narrow the include pattern:

```ts
litJsx({
  include: /src\/.*\.tsx$/,  // Only process src directory
  exclude: [/node_modules/, /dist/],
})
```

## Next Steps

- Learn about [TypeScript](/guide/typescript) integration
- Explore [Performance](/guide/performance) optimization
- Check out the [API Reference](/api/index)
