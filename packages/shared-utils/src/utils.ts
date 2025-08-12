import type { Point } from "@whiteboard/shared-types";

export function generateId(): string {
	return Math.random().toString(36).substr(2, 9);
}

export function getPointerPosition(event: PointerEvent): Point {
	return {
		x: event.clientX,
		y: event.clientY,
	};
}

export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
