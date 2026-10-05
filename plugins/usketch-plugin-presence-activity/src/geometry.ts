import type { BoundingBox, Viewport } from "@edv4h/usketch-shared";

/** World-space rect → screen-space rect (same transform the canvas applies). */
export function worldRectToScreen(b: BoundingBox, vp: Viewport): BoundingBox {
	return {
		x: b.x * vp.zoom + vp.x,
		y: b.y * vp.zoom + vp.y,
		width: b.width * vp.zoom,
		height: b.height * vp.zoom,
	};
}

/** Smallest box enclosing all inputs, or `null` when empty. */
export function unionBounds(boxes: readonly BoundingBox[]): BoundingBox | null {
	if (boxes.length === 0) return null;
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const b of boxes) {
		minX = Math.min(minX, b.x);
		minY = Math.min(minY, b.y);
		maxX = Math.max(maxX, b.x + b.width);
		maxY = Math.max(maxY, b.y + b.height);
	}
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Deterministic fallback color for a participant with no `user.color`. */
const PALETTE = [
	"#e74c3c",
	"#3498db",
	"#2ecc71",
	"#f39c12",
	"#9b59b6",
	"#1abc9c",
	"#e67e22",
	"#e84393",
];
export function fallbackColor(clientId: number): string {
	return PALETTE[Math.abs(clientId) % PALETTE.length];
}
