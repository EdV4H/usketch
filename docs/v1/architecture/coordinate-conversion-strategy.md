# Coordinate Conversion Strategy

## Overview

This document describes the architectural decision around where and how coordinate conversion happens in the uSketch whiteboard application, specifically the conversion between screen coordinates (raw pixel positions) and world coordinates (canvas space affected by camera zoom/pan).

## The Problem

Different tools require different coordinate systems:

- **Drawing tools** (rectangle, ellipse, select): Need **world coordinates** - positions in the canvas space that account for zoom and pan
- **Pan tool**: Needs **screen coordinates** - raw pixel positions to calculate camera movement

The question is: **Where should this coordinate conversion happen?**

## Current Implementation (Adopted Solution)

### Architecture
Coordinate conversion happens at the **application integration layer** (`use-tool-manager.ts` and `use-interaction.ts`).

### Implementation Details

```typescript
// In use-tool-manager.ts
const handlePointerMove = useCallback(
  (e: PointerEvent, camera: { x: number; y: number; zoom: number }) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Application layer decides which coordinate system to use
    const pos = currentTool === "pan"
      ? { x: e.clientX, y: e.clientY }  // Screen coordinates for pan
      : screenToWorld(screenX, screenY, camera);  // World coordinates for others

    toolManagerRef.current.handlePointerMove(e, pos);
  },
  [screenToWorld, currentTool],
);
```

### Pros
- ✅ Simple and straightforward
- ✅ Minimal changes required
- ✅ Tools remain decoupled from coordinate conversion logic
- ✅ All tests pass
- ✅ Clear separation: tools work in their preferred coordinate system

### Cons
- ❌ Application layer needs to know which coordinate system each tool requires
- ❌ If-else logic based on tool type
- ❌ Not easily extensible for future tools with different coordinate needs

## Alternative Approach 1: PointerCoordinates Interface

### Proposed Architecture
Pass both coordinate systems to all tools via a new `PointerCoordinates` interface, letting each tool choose which to use.

### Implementation (Attempted)

```typescript
// In shared-types/src/index.ts
export interface PointerCoordinates {
  world: Point;   // Canvas/world space coordinates
  screen: Point;  // Screen/viewport space coordinates
}

// In use-tool-machine.ts
const handlePointerMove = (coords: PointerCoordinates, e: React.PointerEvent) => {
  if (currentTool === "select") {
    sendEvent({
      type: "POINTER_MOVE",
      point: coords.world,  // Select tool uses world coords
    });
  } else if (currentTool === "pan") {
    sendEvent({
      type: "POINTER_MOVE",
      point: coords.screen,  // Pan tool uses screen coords
    });
  }
};
```

### Why It Was Reverted

**Test Failure**: The upward pan direction stopped working correctly after implementation.

```
Error: expect(afterUpPan.y).toBeLessThan(initialCamera.y)
Expected: < 0
Received: 95
```

The test failure indicated a subtle bug in how screen coordinates were being calculated or passed through the system, showing that this approach requires more careful implementation and broader testing.

### Pros
- ✅ More flexible - tools explicitly choose their coordinate system
- ✅ Type-safe interface for coordinate data
- ✅ Easier to extend for future tools with mixed coordinate needs
- ✅ Better separation of concerns

### Cons
- ❌ Requires changes across multiple layers (types, hooks, tools)
- ❌ Introduced bugs that broke existing functionality
- ❌ More complex data flow
- ❌ Performance impact of calculating both coordinate systems on every event

## Alternative Approach 2: Shared Utility Function

### Proposed Architecture
Extract coordinate conversion to a shared utility that tools can call when needed.

### Example Implementation

```typescript
// In shared-utils
export const coordinateUtils = {
  screenToWorld: (
    screen: Point,
    camera: Camera,
    rect: DOMRect
  ): Point => {
    const localX = screen.x - rect.left;
    const localY = screen.y - rect.top;
    return {
      x: (localX - camera.x) / camera.zoom,
      y: (localY - camera.y) / camera.zoom,
    };
  },

  worldToScreen: (
    world: Point,
    camera: Camera,
    rect: DOMRect
  ): Point => {
    return {
      x: world.x * camera.zoom + camera.x + rect.left,
      y: world.y * camera.zoom + camera.y + rect.top,
    };
  },
};

// Tools that need conversion would import and use these utilities
```

### Pros
- ✅ Reusable utility functions
- ✅ Tools have direct control over coordinate conversion
- ✅ Easy to test in isolation
- ✅ Flexible for different use cases

### Cons
- ❌ Tools need access to camera state and DOM rect
- ❌ Couples tools more tightly to the rendering context
- ❌ Requires passing more context to tools
- ❌ Each tool needs to implement conversion logic

## Decision Rationale

**Current implementation is maintained** for the following reasons:

1. **Stability**: It works correctly with all existing features and tests
2. **Simplicity**: Easy to understand and maintain
3. **Performance**: Only calculates needed coordinates (no overhead)
4. **Pragmatism**: The if-else logic is acceptable given we have a small, known set of tools

The `PointerCoordinates` approach is architecturally cleaner but introduces bugs and requires more extensive refactoring. It may be worth revisiting if:
- We add many more tools with varying coordinate needs
- We need runtime-pluggable tools
- The if-else logic becomes unwieldy

## Future Considerations

If we revisit the `PointerCoordinates` approach:

1. **Debug the test failure**: Carefully trace through how screen coordinates flow through `use-interaction.ts` → `use-tool-machine.ts` → pan tool state machine
2. **Add intermediate tests**: Test coordinate conversion separately before integrating
3. **Refactor incrementally**: Start with one tool at a time rather than changing all at once
4. **Consider performance**: Calculate coordinates lazily or cache when possible

## Related Files

- `packages/react-canvas/src/hooks/use-tool-manager.ts` - Main coordinate conversion logic
- `packages/react-canvas/src/hooks/use-interaction.ts` - Deprecated hook with similar pattern
- `packages/tools/src/tools/pan-tool.ts` - Pan tool state machine (uses screen coords)
- `packages/tools/src/tools/select-tool.ts` - Select tool (uses world coords)
- `packages/shared-types/src/index.ts` - Type definitions including `Point`

## References

- PR #160: Pan tool drag issues and coordinate conversion discussion
- E2E Tests: `apps/e2e/tests/pan-tool.spec.ts` - Critical test suite for pan functionality
