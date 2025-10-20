# Whiteboard Anatomy Pattern Guide

## Overview

The `Whiteboard` component now supports two usage patterns:

1. **Bundle Pattern** (Convenient): All providers automatically wrapped
2. **Anatomy Pattern** (Flexible): Explicit control over component composition

This guide focuses on the Anatomy Pattern, which provides maximum flexibility and explicit provider management.

## Bundle Pattern (Existing, Still Supported)

The simplest way to use the Whiteboard component:

```tsx
import { WhiteboardCanvas } from "@usketch/react-canvas";
import { defaultShapePlugins } from "@usketch/shape-plugins";
import { ripplePlugin, pinPlugin } from "./effects";

function App() {
  return (
    <WhiteboardCanvas
      shapes={defaultShapePlugins}
      effects={[ripplePlugin, pinPlugin]}
      className="my-whiteboard"
      background={{ id: "usketch.dots" }}
    />
  );
}
```

**Pros:**
- ✅ Simple and quick to set up
- ✅ Automatic provider wrapping

**Cons:**
- ❌ Provider setup is implicit (not obvious to users)
- ❌ Limited control over provider configuration
- ❌ Harder to test or mock providers

## Anatomy Pattern (New, Recommended)

Explicit component composition with full control:

```tsx
import { Whiteboard } from "@usketch/react-canvas";
import { defaultShapePlugins } from "@usketch/shape-plugins";
import { ripplePlugin, pinPlugin } from "./effects";

function App() {
  return (
    <div className="my-app">
      <Whiteboard.ShapeRegistry plugins={defaultShapePlugins}>
        <Whiteboard.EffectRegistry plugins={[ripplePlugin, pinPlugin]}>
          <Whiteboard.Canvas
            className="my-whiteboard"
            background={{ id: "usketch.dots" }}
          />
        </Whiteboard.EffectRegistry>
      </Whiteboard.ShapeRegistry>
    </div>
  );
}
```

**Note**: `Whiteboard.Root` is optional and provided for convenience. You can use your own container element instead.

**Pros:**
- ✅ Explicit provider visibility
- ✅ Full control over provider configuration
- ✅ Easy to test and mock
- ✅ Radix UI-like consistent API

**Cons:**
- ❌ Slightly more verbose

## Component Breakdown

### `Whiteboard.Root`

An optional container component provided for convenience. You can use your own container element instead.

```tsx
<Whiteboard.Root className="custom-app-container">
  {/* ... */}
</Whiteboard.Root>
```

**Props:**
- `className?: string` - CSS class name
- `children: ReactNode` - Child components

**Note**: This component is completely optional. It's just a simple `div` wrapper for convenience.

### `Whiteboard.ShapeRegistry`

Wraps the canvas with `ShapeRegistryProvider`. Manages shape plugin registration.

```tsx
<Whiteboard.ShapeRegistry plugins={shapePlugins}>
  {/* ... */}
</Whiteboard.ShapeRegistry>
```

**Props:**
- `plugins?: readonly ShapePlugin[]` - Shape plugins to register
- `registry?: ShapeRegistry` - Custom registry instance
- `onRegistryChange?: (event: RegistryEvent) => void` - Registry change callback
- `children: ReactNode` - Child components

### `Whiteboard.EffectRegistry`

Wraps the canvas with `EffectRegistryProvider`. Manages effect plugin registration.

```tsx
<Whiteboard.EffectRegistry plugins={effectPlugins}>
  {/* ... */}
</Whiteboard.EffectRegistry>
```

**Props:**
- `plugins?: EffectPlugin[]` - Effect plugins to register
- `registry?: EffectRegistry` - Custom registry instance
- `children: ReactNode` - Child components

### `Whiteboard.Canvas`

The core canvas component without any provider wrappers.

```tsx
<Whiteboard.Canvas
  className="whiteboard"
  background={{ id: "usketch.dots" }}
  onReady={(canvas) => console.log("Canvas ready!", canvas)}
/>
```

**Props:**
- `className?: string` - CSS class name
- `background?: BackgroundConfig` - Background configuration
- `onReady?: (canvas: CanvasManager) => void` - Callback when canvas is ready

## Advanced Use Cases

### Custom Registry Configuration

Use a custom registry instance for advanced control:

```tsx
import { ShapeRegistry } from "@usketch/shape-registry";
import { EffectRegistry } from "@usketch/effect-registry";

const customShapeRegistry = new ShapeRegistry();
const customEffectRegistry = new EffectRegistry();

function App() {
  return (
    <div className="app">
      <Whiteboard.ShapeRegistry
        registry={customShapeRegistry}
        plugins={defaultShapePlugins}
        onRegistryChange={(event) => console.log("Registry changed:", event)}
      >
        <Whiteboard.EffectRegistry
          registry={customEffectRegistry}
          plugins={[ripplePlugin]}
        >
          <Whiteboard.Canvas />
        </Whiteboard.EffectRegistry>
      </Whiteboard.ShapeRegistry>
    </div>
  );
}
```

### Conditional Provider Wrapping

Conditionally wrap with providers based on runtime conditions:

```tsx
function App() {
  const [enableEffects, setEnableEffects] = useState(true);

  const canvas = <Whiteboard.Canvas />;

  return (
    <div className="app">
      <Whiteboard.ShapeRegistry plugins={defaultShapePlugins}>
        {enableEffects ? (
          <Whiteboard.EffectRegistry plugins={[ripplePlugin]}>
            {canvas}
          </Whiteboard.EffectRegistry>
        ) : (
          canvas
        )}
      </Whiteboard.ShapeRegistry>
    </div>
  );
}
```

### Testing with Custom Registries

Easier to test with explicit providers:

```tsx
import { render } from "@testing-library/react";
import { ShapeRegistry } from "@usketch/shape-registry";
import { Whiteboard } from "@usketch/react-canvas";

test("renders whiteboard with custom registry", () => {
  const mockRegistry = new ShapeRegistry();

  const { container } = render(
    <Whiteboard.ShapeRegistry registry={mockRegistry} plugins={[]}>
      <Whiteboard.Canvas />
    </Whiteboard.ShapeRegistry>
  );

  expect(container.querySelector(".whiteboard-canvas")).toBeInTheDocument();
});
```

### Multiple Canvas Instances with Shared Registry

Share a single registry across multiple canvas instances:

```tsx
import { ShapeRegistry } from "@usketch/shape-registry";

const sharedRegistry = new ShapeRegistry();

function App() {
  return (
    <Whiteboard.ShapeRegistry registry={sharedRegistry} plugins={defaultShapePlugins}>
      <div className="dual-canvas-layout">
        <Whiteboard.Canvas className="canvas-1" />
        <Whiteboard.Canvas className="canvas-2" />
      </div>
    </Whiteboard.ShapeRegistry>
  );
}
```

## Migration Guide

### From Bundle Pattern to Anatomy Pattern

**Before:**
```tsx
<WhiteboardCanvas
  shapes={plugins}
  effects={effects}
  className="whiteboard"
  background={{ id: "usketch.dots" }}
/>
```

**After:**
```tsx
<Whiteboard.ShapeRegistry plugins={plugins}>
  <Whiteboard.EffectRegistry plugins={effects}>
    <Whiteboard.Canvas
      className="whiteboard"
      background={{ id: "usketch.dots" }}
    />
  </Whiteboard.EffectRegistry>
</Whiteboard.ShapeRegistry>
```

## Best Practices

1. **Use Anatomy Pattern for new projects**: Better explicitness and testability
2. **Bundle Pattern is still valid**: Use it for quick prototypes or simple apps
3. **Custom registries for testing**: Easier to mock and control in tests
4. **Share registries when needed**: Multiple canvas instances can share state

## API Reference

### Type Exports

```tsx
import type {
  WhiteboardRootProps,
  WhiteboardShapeRegistryProps,
  WhiteboardEffectRegistryProps,
  WhiteboardCanvasProps,
} from "@usketch/react-canvas";
```

### Component Exports

```tsx
import {
  Whiteboard,           // Main compound component
  WhiteboardCanvas,     // Bundle pattern component (legacy)
} from "@usketch/react-canvas";
```

## Comparison with Radix UI

This pattern is inspired by Radix UI's Anatomy pattern:

**Radix UI Example:**
```tsx
<Dialog.Root>
  <Dialog.Trigger />
  <Dialog.Portal>
    <Dialog.Content />
  </Dialog.Portal>
</Dialog.Root>
```

**Whiteboard Example:**
```tsx
<Whiteboard.ShapeRegistry>
  <Whiteboard.EffectRegistry>
    <Whiteboard.Canvas />
  </Whiteboard.EffectRegistry>
</Whiteboard.ShapeRegistry>
```

Both provide explicit control over component composition while maintaining flexibility.
