import { Point } from '../types';

export interface Tool {
  id: string;
  name: string;
  icon?: string;
  
  // Lifecycle methods
  activate(): void;
  deactivate(): void;
  
  // Event handlers
  onPointerDown(event: PointerEvent, worldPos: Point): void;
  onPointerMove(event: PointerEvent, worldPos: Point): void;
  onPointerUp(event: PointerEvent, worldPos: Point): void;
  onKeyDown?(event: KeyboardEvent): void;
  onKeyUp?(event: KeyboardEvent): void;
}

export abstract class BaseTool implements Tool {
  abstract id: string;
  abstract name: string;
  icon?: string;
  
  activate(): void {
    // Override in subclasses if needed
  }
  
  deactivate(): void {
    // Override in subclasses if needed
  }
  
  abstract onPointerDown(event: PointerEvent, worldPos: Point): void;
  abstract onPointerMove(event: PointerEvent, worldPos: Point): void;
  abstract onPointerUp(event: PointerEvent, worldPos: Point): void;
  
  onKeyDown?(event: KeyboardEvent): void;
  onKeyUp?(event: KeyboardEvent): void;
}