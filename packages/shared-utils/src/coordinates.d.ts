import type { Camera, Point } from '@whiteboard/shared-types';
/**
 * Convert screen coordinates to world coordinates
 */
export declare function screenToWorld(screenPoint: Point, camera: Camera): Point;
/**
 * Convert world coordinates to screen coordinates
 */
export declare function worldToScreen(worldPoint: Point, camera: Camera): Point;
/**
 * Get the mouse position relative to the canvas element
 */
export declare function getCanvasMousePosition(event: MouseEvent, canvasElement: HTMLElement): Point;
/**
 * Apply camera transform to a DOM element
 */
export declare function applyCameraTransform(element: HTMLElement, camera: Camera): void;
/**
 * Apply shape transform to a DOM element
 */
export declare function applyShapeTransform(element: HTMLElement, shape: {
    x: number;
    y: number;
    rotation: number;
}): void;
//# sourceMappingURL=coordinates.d.ts.map