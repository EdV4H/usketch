import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WhiteboardCanvas } from './canvas';
import { useWhiteboardStore } from './store';
import { createMockElement } from './test/utils';

describe('WhiteboardCanvas', () => {
  let container: HTMLElement;
  let canvas: WhiteboardCanvas;

  beforeEach(() => {
    // Reset store
    useWhiteboardStore.setState({ shapes: [], selectedShapeIds: [] });
    
    // Create container
    container = createMockElement('div', { id: 'test-canvas' });
    document.body.appendChild(container);
    
    // Initialize canvas
    canvas = new WhiteboardCanvas(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('initialization', () => {
    it('should create canvas with correct structure', () => {
      const canvasEl = container as HTMLElement;
      expect(canvasEl.classList.contains('whiteboard-canvas')).toBeTruthy();
      expect(container.querySelector('.shape-layer')).toBeTruthy();
      expect(container.querySelector('.selection-layer')).toBeTruthy();
    });

    it('should set default styles', () => {
      const shapeLayer = container.querySelector('.shape-layer') as HTMLElement;
      expect(shapeLayer).toBeTruthy();
      expect(shapeLayer.style.position).toBe('absolute');
      expect(shapeLayer.style.width).toBe('100%');
      expect(shapeLayer.style.height).toBe('100%');
    });

    it('should attach event listeners', () => {
      const canvasEl = container as HTMLElement;
      const mouseDownEvent = new MouseEvent('mousedown');
      
      // Test that event doesn't throw
      expect(() => canvasEl.dispatchEvent(mouseDownEvent)).not.toThrow();
    });
  });

  describe('shape rendering', () => {
    it('should render shapes from store', () => {
      const testShape = {
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
      
      whiteboardStore.getState().addShape(testShape);
      
      const shapeElement = container.querySelector(`[data-shape-id="${testShape.id}"]`);
      expect(shapeElement).toBeTruthy();
      expect(shapeElement?.getAttribute('data-shape-type')).toBe('rectangle');
    });

    it('should update shape position when store changes', () => {
      const testShape = {
        id: 'test-2',
        type: 'rectangle' as const,
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
      
      whiteboardStore.getState().addShape(testShape);
      
      // Update position
      whiteboardStore.getState().updateShape(testShape.id, { x: 150, y: 150 });
      
      const shapeElement = container.querySelector(`[data-shape-id="${testShape.id}"]`) as HTMLElement;
      expect(shapeElement.style.transform).toContain('translate(150px, 150px)');
    });

    it('should remove shape element when deleted from store', () => {
      const testShape = {
        id: 'test-3',
        type: 'ellipse' as const,
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
      
      whiteboardStore.getState().addShape(testShape);
      expect(container.querySelector(`[data-shape-id="${testShape.id}"]`)).toBeTruthy();
      
      whiteboardStore.getState().removeShape(testShape.id);
      expect(container.querySelector(`[data-shape-id="${testShape.id}"]`)).toBeFalsy();
    });
  });

  describe('selection', () => {
    it('should show selection box when shape is selected', () => {
      const testShape = {
        id: 'test-4',
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
      
      whiteboardStore.getState().addShape(testShape);
      whiteboardStore.getState().selectShape(testShape.id);
      
      const selectionBox = container.querySelector('.selection-box');
      expect(selectionBox).toBeTruthy();
    });

    it('should show resize handles for selected shape', () => {
      const testShape = {
        id: 'test-5',
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
      
      whiteboardStore.getState().addShape(testShape);
      whiteboardStore.getState().selectShape(testShape.id);
      
      const handles = container.querySelectorAll('.resize-handle');
      expect(handles.length).toBe(8); // 8 resize handles
    });

    it('should clear selection when clicking on empty area', () => {
      const testShape = {
        id: 'test-6',
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
      
      whiteboardStore.getState().addShape(testShape);
      whiteboardStore.getState().selectShape(testShape.id);
      
      // Click on empty area
      const canvasEl = container.querySelector('.whiteboard-canvas') as HTMLElement;
      const clickEvent = new MouseEvent('click', {
        clientX: 10,
        clientY: 10,
        bubbles: true
      });
      canvasEl.dispatchEvent(clickEvent);
      
      expect(whiteboardStore.getState().selectedShapeIds).toHaveLength(0);
    });
  });

  describe('shape manipulation', () => {
    it('should start dragging on mousedown', () => {
      const testShape = {
        id: 'test-7',
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
      
      whiteboardStore.getState().addShape(testShape);
      whiteboardStore.getState().selectShape(testShape.id);
      
      const shapeElement = container.querySelector(`[data-shape-id="${testShape.id}"]`) as HTMLElement;
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: 150,
        clientY: 150,
        bubbles: true
      });
      
      shapeElement.dispatchEvent(mouseDownEvent);
      
      // Check if dragging state is set
      expect(canvas['draggingShape']).toBe(testShape.id);
    });

    it('should update shape position on drag', () => {
      const testShape = {
        id: 'test-8',
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
      
      whiteboardStore.getState().addShape(testShape);
      whiteboardStore.getState().selectShape(testShape.id);
      
      const shapeElement = container.querySelector(`[data-shape-id="${testShape.id}"]`) as HTMLElement;
      
      // Start drag
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: 150,
        clientY: 150,
        bubbles: true
      });
      shapeElement.dispatchEvent(mouseDownEvent);
      
      // Move
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 200,
        clientY: 200,
        bubbles: true
      });
      document.dispatchEvent(mouseMoveEvent);
      
      // End drag
      const mouseUpEvent = new MouseEvent('mouseup', {
        bubbles: true
      });
      document.dispatchEvent(mouseUpEvent);
      
      const updatedShape = whiteboardStore.getState().shapes[0];
      expect(updatedShape.x).toBe(150);
      expect(updatedShape.y).toBe(150);
    });
  });

  describe('addTestShape', () => {
    it('should add a test rectangle shape', () => {
      const initialCount = whiteboardStore.getState().shapes.length;
      
      canvas.addTestShape();
      
      const shapes = whiteboardStore.getState().shapes;
      expect(shapes.length).toBe(initialCount + 1);
      expect(shapes[shapes.length - 1].type).toBe('rectangle');
    });
  });
});