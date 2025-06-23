import { Point, Camera } from './types';

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function screenToWorld(screenPoint: Point, camera: Camera): Point {
  return {
    x: (screenPoint.x - camera.x) / camera.zoom,
    y: (screenPoint.y - camera.y) / camera.zoom
  };
}

export function worldToScreen(worldPoint: Point, camera: Camera): Point {
  return {
    x: worldPoint.x * camera.zoom + camera.x,
    y: worldPoint.y * camera.zoom + camera.y
  };
}

export function getPointerPosition(event: PointerEvent): Point {
  return {
    x: event.clientX,
    y: event.clientY
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}