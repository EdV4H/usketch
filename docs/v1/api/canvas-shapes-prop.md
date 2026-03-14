# WhiteboardCanvas shapes Prop - Shape Plugin Registration

## Overview

The `WhiteboardCanvas` component now accepts a `shapes` prop that allows you to register custom shape plugins directly on the canvas component. This enables you to define which shape types are available for a specific canvas instance without needing to wrap it in a `ShapeRegistryProvider`.

## Usage

### Basic Usage - With shapes prop

```tsx
import { WhiteboardCanvas } from "@usketch/react-canvas";
import { defaultShapePlugins } from "@usketch/shape-plugins";

function App() {
  return (
    <WhiteboardCanvas
      shapes={defaultShapePlugins}
      className="whiteboard"
      background={backgroundConfig}
      onReady={handleCanvasReady}
    />
  );
}
```

### Advanced Usage - Custom Shape Plugins

```tsx
import { WhiteboardCanvas } from "@usketch/react-canvas";
import type { ShapePlugin } from "@usketch/shape-registry";
import { MyCustomShape } from "./shapes/MyCustomShape";

const customShapePlugin: ShapePlugin = {
  type: "custom-shape",
  name: "Custom Shape",
  component: MyCustomShape,
  createDefaultShape: (props) => ({
    ...props,
    type: "custom-shape",
    width: 100,
    height: 100,
    // ... other shape properties
  }),
  getBounds: (shape) => ({
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
  }),
  hitTest: (shape, point) => {
    // Hit test implementation
    return (
      point.x >= shape.x &&
      point.x <= shape.x + shape.width &&
      point.y >= shape.y &&
      point.y <= shape.y + shape.height
    );
  },
};

function App() {
  const shapes = [
    ...defaultShapePlugins,
    customShapePlugin,
  ];

  return (
    <WhiteboardCanvas
      shapes={shapes}
      className="whiteboard"
      onReady={handleCanvasReady}
    />
  );
}
```

## Props

### shapes?: ShapePlugin[]

An optional array of ShapePlugin objects to register with the canvas. Each ShapePlugin must implement:

- `type: string` - Unique identifier for the shape type
- `name?: string` - Display name for the shape
- `component: ComponentType<ShapeComponentProps>` - React component for rendering
- `createDefaultShape: (props) => Shape` - Factory function for creating shapes
- `getBounds: (shape) => Bounds` - Get the bounding box
- `hitTest: (shape, point) => boolean` - Test if a point is inside the shape

Optional plugin properties:
- `toolComponent?: ComponentType<ToolProps>` - Tool component for creating/editing
- `icon?: ComponentType` - Icon component for UI
- `serialize?: (shape) => any` - Serialize for storage
- `deserialize?: (data) => Shape` - Deserialize from storage
- `validate?: (shape) => boolean` - Validate shape data

## How It Works

1. **With shapes prop**: When you provide the `shapes` prop, WhiteboardCanvas automatically wraps itself with a ShapeRegistryProvider and registers all provided plugins.

2. **Without shapes prop**: If no `shapes` prop is provided, the component assumes a parent ShapeRegistryProvider exists and uses that instead.

This dual behavior allows for flexible architecture:
- Use the `shapes` prop for simple, self-contained canvas instances
- Use a parent `ShapeRegistryProvider` for complex apps with multiple canvases sharing the same shape registry

## Examples

### Example 1: Different Shapes for Different Canvases

```tsx
const drawingShapes = [rectanglePlugin, ellipsePlugin, freedrawPlugin];
const diagramShapes = [rectanglePlugin, arrowPlugin, textPlugin];

function MultiCanvasApp() {
  return (
    <div className="app">
      <div className="drawing-area">
        <WhiteboardCanvas shapes={drawingShapes} />
      </div>
      <div className="diagram-area">
        <WhiteboardCanvas shapes={diagramShapes} />
      </div>
    </div>
  );
}
```

### Example 2: Shared Registry with Parent Provider

```tsx
import { ShapeRegistryProvider } from "@usketch/shape-registry";

function App() {
  return (
    <ShapeRegistryProvider plugins={defaultShapePlugins}>
      <div className="app">
        {/* These canvases share the same shape registry */}
        <WhiteboardCanvas className="canvas-1" />
        <WhiteboardCanvas className="canvas-2" />
      </div>
    </ShapeRegistryProvider>
  );
}
```

### Example 3: Dynamic Shape Registration

```tsx
function DynamicCanvas() {
  const [availableShapes, setAvailableShapes] = useState(basicShapes);

  const addAdvancedShapes = () => {
    setAvailableShapes([...basicShapes, ...advancedShapes]);
  };

  return (
    <div>
      <button onClick={addAdvancedShapes}>Enable Advanced Shapes</button>
      <WhiteboardCanvas shapes={availableShapes} />
    </div>
  );
}
```

## Migration Guide

### From External Provider

Before:
```tsx
<ShapeRegistryProvider plugins={defaultShapePlugins}>
  <WhiteboardCanvas />
</ShapeRegistryProvider>
```

After (Option 1 - Using shapes prop):
```tsx
<WhiteboardCanvas shapes={defaultShapePlugins} />
```

After (Option 2 - Keep external provider):
```tsx
// No change needed - external provider still works
<ShapeRegistryProvider plugins={defaultShapePlugins}>
  <WhiteboardCanvas />
</ShapeRegistryProvider>
```

## Best Practices

1. **Use shapes prop for simple cases**: When you have a single canvas with a fixed set of shapes
2. **Use external provider for complex cases**: When multiple components need to access the same shape registry
3. **Avoid both**: Don't use both shapes prop and external provider - choose one approach
4. **Plugin uniqueness**: Ensure all shape types are unique within a registry