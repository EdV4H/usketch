# @whiteboard/canvas-core

Core canvas functionality for the whiteboard application.

## Migration Status

This package has been migrated from the main `src/canvas.ts` file with the following changes:

1. **Renamed class**: `WhiteboardCanvas` → `Canvas`
2. **Updated imports**: Now uses `@whiteboard/shared-types` and `@whiteboard/shared-utils`
3. **Temporary placeholders**: Created placeholder implementations for:
   - `store.ts` - WhiteboardStore interface and mock implementation
   - `tools/ToolManager.ts` - Tool management placeholder
   - `components/SelectionLayer.ts` - Selection layer placeholder

## Dependencies

- `@whiteboard/shared-types` - Shared type definitions
- `@whiteboard/shared-utils` - Shared utility functions

## Build

```bash
npm run build
```

## Usage

```typescript
import { Canvas } from '@whiteboard/canvas-core';

const canvasElement = document.getElementById('canvas');
const canvas = new Canvas(canvasElement);
```

## TODO

- Move the store implementation to a separate `@whiteboard/store` package
- Move tool management to a separate `@whiteboard/tools` package
- Implement proper selection layer functionality
- Add tests