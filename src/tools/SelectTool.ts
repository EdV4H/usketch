import { BaseTool } from './Tool';
import { Point } from '../types';
import { whiteboardStore } from '../store';

export class SelectTool extends BaseTool {
  id = 'select';
  name = 'Select';
  
  private isDragging = false;
  private draggedShapeId: string | null = null;
  private dragStart: Point | null = null;
  private shapeStartPosition: Point | null = null;
  
  activate(): void {
    const canvas = document.getElementById('canvas');
    if (canvas) {
      canvas.style.cursor = 'default';
    }
  }
  
  deactivate(): void {
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
    const shapeId = shapeElement?.dataset.shapeId;
    
    if (shapeId) {
      // Handle shape selection
      if (!event.shiftKey && !store.selectedShapeIds.has(shapeId)) {
        store.clearSelection();
      }
      
      if (store.selectedShapeIds.has(shapeId)) {
        // If already selected, prepare for dragging
        this.isDragging = true;
        this.draggedShapeId = shapeId;
        this.dragStart = worldPos;
        const shape = store.shapes[shapeId];
        this.shapeStartPosition = { x: shape.x, y: shape.y };
      } else {
        // Select the shape
        store.selectShape(shapeId);
      }
    } else {
      // Clicking on empty space - clear selection
      if (!event.shiftKey) {
        store.clearSelection();
      }
    }
  }
  
  onPointerMove(event: PointerEvent, worldPos: Point): void {
    if (!this.isDragging || !this.draggedShapeId || !this.dragStart || !this.shapeStartPosition) return;
    
    const deltaX = worldPos.x - this.dragStart.x;
    const deltaY = worldPos.y - this.dragStart.y;
    
    whiteboardStore.getState().updateShape(this.draggedShapeId, {
      x: this.shapeStartPosition.x + deltaX,
      y: this.shapeStartPosition.y + deltaY
    });
  }
  
  onPointerUp(event: PointerEvent, worldPos: Point): void {
    this.isDragging = false;
    this.draggedShapeId = null;
    this.dragStart = null;
    this.shapeStartPosition = null;
  }
}