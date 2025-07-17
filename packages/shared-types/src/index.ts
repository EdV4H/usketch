// Base shape interface
export interface BaseShape {
  id: string;
  type: 'rectangle' | 'ellipse' | 'line' | 'text' | 'freedraw';
  x: number; // World coordinates
  y: number; // World coordinates
  rotation: number; // Radians
  opacity: number;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
}

// Rectangle shape
export interface RectangleShape extends BaseShape {
  type: 'rectangle';
  width: number;
  height: number;
}

// Ellipse shape
export interface EllipseShape extends BaseShape {
  type: 'ellipse';
  width: number;
  height: number;
}

// Line shape
export interface LineShape extends BaseShape {
  type: 'line';
  x2: number;
  y2: number;
}

// Text shape
export interface TextShape extends BaseShape {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
}

// Freedraw shape
export interface FreedrawShape extends BaseShape {
  type: 'freedraw';
  points: Array<{ x: number; y: number }>;
}

// Union type for all shapes
export type Shape = RectangleShape | EllipseShape | LineShape | TextShape | FreedrawShape;

// Camera/Viewport state
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

// Point interface
export interface Point {
  x: number;
  y: number;
}

// Whiteboard state
export interface WhiteboardState {
  shapes: Record<string, Shape>;
  selectedShapeIds: Set<string>;
  camera: Camera;
  currentTool: string;
}