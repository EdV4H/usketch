import { BaseTool } from './Tool';
import type { Point } from '@whiteboard/shared-types';
import { whiteboardStore } from '@whiteboard/store';

export class SelectTool extends BaseTool {
  id = 'select';
  name = 'Select';
  
  private isDragging = false;
  private draggedShapeId: string | null = null;
  private dragStart: Point | null = null;
  private shapeStartPosition: Point | null = null;
  
  override activate(): void {
    const canvas = document.querySelector('.whiteboard-canvas') as HTMLElement;
    if (canvas) {
      canvas.style.cursor = 'default';
    }
  }
  
  override deactivate(): void {
    this.isDragging = false;
    this.draggedShapeId = null;
    this.dragStart = null;
    this.shapeStartPosition = null;
  }
  
  onPointerDown(event: PointerEvent, worldPos: Point): void {
    const store = whiteboardStore.getState();
    
    // Check if clicking on a shape
    const target = event.target as HTMLElement;
    const shapeElement = target.closest('[data-shape="true"]') as HTMLElement;
    const shapeId = shapeElement?.dataset['shapeId'];
    
    if (shapeId) {
      // Handle shape selection
      if (!event.shiftKey && !store.selectedShapeIds.has(shapeId)) {
        whiteboardStore.getState().clearSelection();
      }
      
      if (store.selectedShapeIds.has(shapeId)) {
        // If already selected, prepare for dragging
        this.isDragging = true;
        this.draggedShapeId = shapeId;
        this.dragStart = worldPos;
        const shape = store.shapes[shapeId];
        if (shape) {
          this.shapeStartPosition = { x: shape.x, y: shape.y };
        }
      } else {
        // Select the shape
        whiteboardStore.getState().selectShape(shapeId);
      }
    } else {
      // Clicking on empty space - clear selection
      if (!event.shiftKey) {
        whiteboardStore.getState().clearSelection();
      }
    }
  }
  
  onPointerMove(_event: PointerEvent, worldPos: Point): void {
    if (!this.isDragging || !this.draggedShapeId || !this.dragStart || !this.shapeStartPosition) return;
    
    const deltaX = worldPos.x - this.dragStart.x;
    const deltaY = worldPos.y - this.dragStart.y;
    
    whiteboardStore.getState().updateShape(this.draggedShapeId, {
      x: this.shapeStartPosition.x + deltaX,
      y: this.shapeStartPosition.y + deltaY
    });
  }
  
  onPointerUp(_event: PointerEvent, _worldPos: Point): void {
    this.isDragging = false;
    this.draggedShapeId = null;
    this.dragStart = null;
    this.shapeStartPosition = null;
  }
}