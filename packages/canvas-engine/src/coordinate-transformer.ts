import type { Point, Viewport } from "@usketch/shared";

export function screenToWorld(point: Point, viewport: Viewport): Point {
	return {
		x: (point.x - viewport.x) / viewport.zoom,
		y: (point.y - viewport.y) / viewport.zoom,
	};
}

export function worldToScreen(point: Point, viewport: Viewport): Point {
	return {
		x: point.x * viewport.zoom + viewport.x,
		y: point.y * viewport.zoom + viewport.y,
	};
}

export function getTransformStyle(viewport: Viewport): string {
	return `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;
}
