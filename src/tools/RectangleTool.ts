import { BaseTool } from './Tool';
import { Point, RectangleShape } from '../types';
import { whiteboardStore } from '../store';

export class RectangleTool extends BaseTool {
  id = 'rectangle';
  name = 'Rectangle';
  
  private isDrawing = false;
  private startPoint: Point | null = null;
  private currentShapeId: string | null = null;
  
  activate(): void {
    // Change cursor to crosshair
    const canvas = document.getElementById('canvas');
    if (canvas) {
      canvas.style.cursor = 'crosshair';
    }
  }
  
  deactivate(): void {
    // Reset cursor
    const canvas = document.getElementById('canvas');
    if (canvas) {
      canvas.style.cursor = 'default';
    }
    
    // Clean up any in-progress drawing
    this.isDrawing = false;
    this.startPoint = null;
    this.currentShapeId = null;
  }
  
  onPointerDown(event: PointerEvent, worldPos: Point): void {
    this.isDrawing = true;
    this.startPoint = worldPos;
    
    // Create a new rectangle shape
    const shapeId = `rect-${Date.now()}`;
    this.currentShapeId = shapeId;
    
    const newShape: RectangleShape = {
      id: shapeId,
      type: 'rectangle',
      x: worldPos.x,
      y: worldPos.y,
      width: 0,
      height: 0,
      rotation: 0,
      opacity: 1,
      strokeColor: '#333333',
      fillColor: '#ffffff',
      strokeWidth: 2
    };
    
    whiteboardStore.getState().addShape(newShape);
  }
  
  onPointerMove(event: PointerEvent, worldPos: Point): void {
    if (!this.isDrawing || !this.startPoint || !this.currentShapeId) return;
    
    // Calculate rectangle dimensions
    const width = worldPos.x - this.startPoint.x;
    const height = worldPos.y - this.startPoint.y;
    
    // Update shape dimensions
    // Handle negative dimensions (drawing from right to left or bottom to top)
    const x = width < 0 ? worldPos.x : this.startPoint.x;
    const y = height < 0 ? worldPos.y : this.startPoint.y;
    
    whiteboardStore.getState().updateShape(this.currentShapeId, {
      x: x,
      y: y,
      width: Math.abs(width),
      height: Math.abs(height)
    });
  }
  
  onPointerUp(event: PointerEvent, worldPos: Point): void {
    if (!this.isDrawing || !this.currentShapeId) return;
    
    // Check if the rectangle is too small (essentially a click)
    const shape = whiteboardStore.getState().shapes[this.currentShapeId];
    if (shape && 'width' in shape && 'height' in shape) {
      if (shape.width < 5 && shape.height < 5) {
        // Remove the shape if it's too small
        whiteboardStore.getState().removeShape(this.currentShapeId);
      }
    }
    
    // Reset drawing state
    this.isDrawing = false;
    this.startPoint = null;
    this.currentShapeId = null;
  }
  
  onKeyDown(event: KeyboardEvent): void {
    // Cancel drawing on Escape
    if (event.key === 'Escape' && this.isDrawing && this.currentShapeId) {
      whiteboardStore.getState().removeShape(this.currentShapeId);
      this.isDrawing = false;
      this.startPoint = null;
      this.currentShapeId = null;
    }
  }
}