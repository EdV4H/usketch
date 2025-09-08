# Unified Shape Abstraction Layer - Sample Shapes

This directory contains sample shapes demonstrating the power of the new unified shape abstraction layer. These shapes showcase different rendering modes and capabilities without requiring developers to handle complex SVG/HTML integration details.

## 🎯 New Sample Shapes

### 1. 🎨 Color Picker (HTML)
**File:** `color-picker-unified.tsx`
- **Render Mode:** HTML
- **Features:**
  - Interactive color palette
  - State management
  - Real-time color selection
  - Hover effects and animations
- **Demonstrates:** How to create rich interactive UI components as shapes

### 2. 📊 Interactive Chart (Hybrid)
**File:** `chart-hybrid-unified.tsx`
- **Render Mode:** Hybrid (SVG + HTML)
- **Features:**
  - SVG-based bar chart visualization
  - HTML overlay for tooltips
  - Click to randomize data
  - Smooth hover animations
- **Demonstrates:** Combining SVG graphics with HTML overlays for complex visualizations

### 3. 🎥 Video Player (HTML)
**File:** `video-player-unified.tsx`
- **Render Mode:** HTML
- **Features:**
  - Embedded video playback
  - Custom controls
  - Progress bar with seeking
  - Play/pause functionality
- **Demonstrates:** Embedding rich media content in shapes

### 4. 🔄 Animated Logo (SVG)
**File:** `animated-logo-unified.tsx`
- **Render Mode:** SVG
- **Features:**
  - Complex SVG animations
  - Multiple rotating elements
  - Orbiting particles
  - Hover interactions
- **Demonstrates:** Pure SVG animations and transformations

### 5. 🔢 Counter (HTML) - Original Comparison
**File:** `html-counter-unified.tsx`
- **Render Mode:** HTML
- **Features:**
  - Simple counter with increment/decrement
  - Clean implementation using BaseShape
- **Demonstrates:** Simplified implementation compared to the original `html-counter.tsx`

## 🚀 Key Benefits Demonstrated

### 1. **Simplified Development**
Compare `html-counter.tsx` (original) with `html-counter-unified.tsx` (new):
- No manual coordinate transformation needed
- No complex Portal management
- Automatic event handling
- Cleaner, more maintainable code

### 2. **Flexible Rendering Modes**
```typescript
// HTML for rich interactive components
renderMode: "html"

// SVG for graphics and animations
renderMode: "svg"

// Hybrid for combining both
renderMode: "hybrid"
```

### 3. **Built-in Features**
- ✅ Automatic coordinate transformation
- ✅ Consistent event handling
- ✅ State management helpers
- ✅ Hit testing
- ✅ Bounds calculation

### 4. **Easy Integration**
All shapes use the same pattern:
```typescript
class MyShape extends BaseShape<MyShapeData> {
  render() { /* Your component */ }
  getBounds() { /* Shape bounds */ }
  hitTest() { /* Hit detection */ }
}

// Register with one line
export const myPlugin = UnifiedShapePluginAdapter.fromBaseShape(...)
```

## 📝 Creating Your Own Shape

1. **Define your shape data structure:**
```typescript
interface MyShapeData {
  id: string;
  type: string;
  x: number;
  y: number;
  // ... your custom properties
}
```

2. **Extend BaseShape:**
```typescript
class MyShape extends BaseShape<MyShapeData> {
  constructor(shape, config) {
    super(shape, {
      ...config,
      renderMode: "html", // or "svg" or "hybrid"
      enableInteractivity: true,
    });
  }
  
  render() {
    return <MyComponent shape={this.shape} />;
  }
  
  getBounds() { /* ... */ }
  hitTest(point) { /* ... */ }
}
```

3. **Create the plugin:**
```typescript
export const myPlugin = UnifiedShapePluginAdapter.fromBaseShape(
  "my-shape-type",
  MyShape,
  createDefaultShape,
  "My Shape Name"
);
```

4. **Add to the registry:**
The shape will automatically be available in the shape tools!

## 🎨 Try It Out!

1. Run the development server: `pnpm dev`
2. Open the whiteboard app
3. Look for the new shapes in the shape tools:
   - Color Picker (Unified)
   - Chart (Hybrid)
   - Video Player (Unified)
   - Animated Logo (Unified)
   - Unified HTML Counter

Each shape demonstrates different capabilities of the unified abstraction layer, making it easy to create complex, interactive shapes without worrying about the underlying implementation details.