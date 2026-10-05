import type { Point, Viewport } from "@edv4h/usketch-shared";
import {
	screenToWorld as sharedScreenToWorld,
	worldToScreen as sharedWorldToScreen,
	viewportTransformStyle,
} from "@edv4h/usketch-shared";

// Point-object wrappers over the shared (rotation-aware) viewport math, so the two
// transform APIs can never drift apart.

export function screenToWorld(point: Point, viewport: Viewport): Point {
	return sharedScreenToWorld(point.x, point.y, viewport);
}

export function worldToScreen(point: Point, viewport: Viewport): Point {
	return sharedWorldToScreen(point.x, point.y, viewport);
}

export function getTransformStyle(viewport: Viewport): string {
	return viewportTransformStyle(viewport);
}
