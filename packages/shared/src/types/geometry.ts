export interface Point {
	x: number;
	y: number;
}

export interface BoundingBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * The camera: `screen = R(rotation) · (zoom · world) + (x, y)`.
 * `rotation` (degrees, clockwise-positive) turns the world about the SCREEN ORIGIN,
 * so the transform stays self-contained (no canvas size needed). Omitted / `0` means
 * no rotation — every transform then reduces exactly to the plain translate+scale.
 */
export interface Viewport {
	x: number;
	y: number;
	zoom: number;
	rotation?: number;
}
