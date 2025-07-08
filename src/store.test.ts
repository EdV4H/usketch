import { describe, it, expect, beforeEach } from 'vitest';
import { useWhiteboardStore } from './store';

describe('WhiteboardStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useWhiteboardStore.setState({ shapes: [], selectedShapeIds: [] });
  });

  describe('shape management', () => {
    it('should add a new shape', () => {
      const store = whiteboardStore.getState();
      const newShape = {
        id: 'test-1',
        type: 'rectangle' as const,
        x: 100,
        y: 100,
        width: 200,
        height: 150,
        rotation: 0,
        opacity: 1,
        strokeColor: '#000000',
        fillColor: '#ffffff',
        strokeWidth: 2
      };

      store.addShape(newShape);

      const shapes = whiteboardStore.getState().shapes;
      expect(shapes).toHaveLength(1);
      expect(shapes[0]).toEqual(newShape);
    });

    it('should update an existing shape', () => {
      const store = whiteboardStore.getState();
      const shape = {
        id: 'test-2',
        type: 'ellipse' as const,
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        strokeColor: '#000000',
        fillColor: '#ffffff',
        strokeWidth: 2
      };

      store.addShape(shape);
      store.updateShape('test-2', { x: 150, y: 150, width: 200 });

      const updatedShape = whiteboardStore.getState().shapes[0];
      expect(updatedShape.x).toBe(150);
      expect(updatedShape.y).toBe(150);
      expect(updatedShape.width).toBe(200);
      expect(updatedShape.height).toBe(100); // Unchanged
    });

    it('should remove a shape', () => {
      const store = whiteboardStore.getState();
      const shape1 = {
        id: 'test-3',
        type: 'rectangle' as const,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        strokeColor: '#000000',
        fillColor: '#ffffff',
        strokeWidth: 2
      };
      const shape2 = {
        id: 'test-4',
        type: 'ellipse' as const,
        x: 200,
        y: 200,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        strokeColor: '#000000',
        fillColor: '#ffffff',
        strokeWidth: 2
      };

      store.addShape(shape1);
      store.addShape(shape2);
      store.removeShape('test-3');

      const shapes = whiteboardStore.getState().shapes;
      expect(shapes).toHaveLength(1);
      expect(shapes[0].id).toBe('test-4');
    });

    it('should not update non-existent shape', () => {
      const store = whiteboardStore.getState();
      const shape = {
        id: 'test-5',
        type: 'rectangle' as const,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        strokeColor: '#000000',
        fillColor: '#ffffff',
        strokeWidth: 2
      };

      store.addShape(shape);
      store.updateShape('non-existent', { x: 100 });

      const shapes = whiteboardStore.getState().shapes;
      expect(shapes[0].x).toBe(0); // Unchanged
    });
  });

  describe('selection management', () => {
    it('should select a single shape', () => {
      const store = whiteboardStore.getState();
      const shape = {
        id: 'test-6',
        type: 'rectangle' as const,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        strokeColor: '#000000',
        fillColor: '#ffffff',
        strokeWidth: 2
      };

      store.addShape(shape);
      store.selectShape('test-6');

      const selectedIds = whiteboardStore.getState().selectedShapeIds;
      expect(selectedIds).toHaveLength(1);
      expect(selectedIds[0]).toBe('test-6');
    });

    it('should select multiple shapes', () => {
      const store = whiteboardStore.getState();
      const shape1 = {
        id: 'test-7',
        type: 'rectangle' as const,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        strokeColor: '#000000',
        fillColor: '#ffffff',
        strokeWidth: 2
      };
      const shape2 = {
        id: 'test-8',
        type: 'ellipse' as const,
        x: 200,
        y: 200,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        strokeColor: '#000000',
        fillColor: '#ffffff',
        strokeWidth: 2
      };

      store.addShape(shape1);
      store.addShape(shape2);
      store.selectMultipleShapes(['test-7', 'test-8']);

      const selectedIds = whiteboardStore.getState().selectedShapeIds;
      expect(selectedIds).toHaveLength(2);
      expect(selectedIds).toContain('test-7');
      expect(selectedIds).toContain('test-8');
    });

    it('should clear selection', () => {
      const store = whiteboardStore.getState();
      const shape = {
        id: 'test-9',
        type: 'rectangle' as const,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        strokeColor: '#000000',
        fillColor: '#ffffff',
        strokeWidth: 2
      };

      store.addShape(shape);
      store.selectShape('test-9');
      store.clearSelection();

      const selectedIds = whiteboardStore.getState().selectedShapeIds;
      expect(selectedIds).toHaveLength(0);
    });

    it('should not select non-existent shape', () => {
      const store = whiteboardStore.getState();
      store.selectShape('non-existent');

      const selectedIds = whiteboardStore.getState().selectedShapeIds;
      expect(selectedIds).toHaveLength(0);
    });

    it('should remove selection when shape is deleted', () => {
      const store = whiteboardStore.getState();
      const shape = {
        id: 'test-10',
        type: 'rectangle' as const,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        strokeColor: '#000000',
        fillColor: '#ffffff',
        strokeWidth: 2
      };

      store.addShape(shape);
      store.selectShape('test-10');
      store.removeShape('test-10');

      const selectedIds = whiteboardStore.getState().selectedShapeIds;
      expect(selectedIds).toHaveLength(0);
    });
  });

  describe('bulk operations', () => {
    it('should update multiple shapes at once', () => {
      const store = whiteboardStore.getState();
      const shape1 = {
        id: 'test-11',
        type: 'rectangle' as const,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        strokeColor: '#000000',
        fillColor: '#ffffff',
        strokeWidth: 2
      };
      const shape2 = {
        id: 'test-12',
        type: 'ellipse' as const,
        x: 200,
        y: 200,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        strokeColor: '#000000',
        fillColor: '#ffffff',
        strokeWidth: 2
      };

      store.addShape(shape1);
      store.addShape(shape2);

      // Update both shapes
      store.updateShape('test-11', { strokeColor: '#ff0000' });
      store.updateShape('test-12', { strokeColor: '#ff0000' });

      const shapes = whiteboardStore.getState().shapes;
      expect(shapes[0].strokeColor).toBe('#ff0000');
      expect(shapes[1].strokeColor).toBe('#ff0000');
    });

    it('should delete multiple selected shapes', () => {
      const store = whiteboardStore.getState();
      
      // Add 3 shapes
      for (let i = 0; i < 3; i++) {
        store.addShape({
          id: `test-bulk-${i}`,
          type: 'rectangle' as const,
          x: i * 100,
          y: 0,
          width: 80,
          height: 80,
          rotation: 0,
          opacity: 1,
          strokeColor: '#000000',
          fillColor: '#ffffff',
          strokeWidth: 2
        });
      }

      // Select first two
      store.selectMultipleShapes(['test-bulk-0', 'test-bulk-1']);

      // Delete selected
      const selectedIds = whiteboardStore.getState().selectedShapeIds;
      selectedIds.forEach(id => store.removeShape(id));

      const remainingShapes = whiteboardStore.getState().shapes;
      expect(remainingShapes).toHaveLength(1);
      expect(remainingShapes[0].id).toBe('test-bulk-2');
    });
  });
});