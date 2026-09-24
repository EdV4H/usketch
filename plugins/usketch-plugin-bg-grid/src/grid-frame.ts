// Pure geometry for drawing the grid under a rotated camera. The viewport maps
// `screen = R·(zoom·w) + t`; the grid is drawn UNROTATED inside a square turned by
// `rotation` about the screen center `c`. In that square's frame a world point sits
// at `zoom·w + t'` with `t' = c + R⁻¹(t − c)`, so the pattern only needs `t'` as its
// phase. The square's side is the padded screen's diagonal, so it covers the screen
// at any angle.
import type { Viewport } from "@edv4h/usketch-shared";
import { viewportRotation } from "@edv4h/usketch-shared";

export interface RotatedGridFrame {
	/** Square box position/size in the layer's (screen) coordinates. */
	left: number;
	top: number;
	side: number;
	/** CSS rotation for the square (about its own center = the screen center). */
	rotation: number;
	/** Pattern phase inside the square, in [0, size). */
	offsetX: number;
	offsetY: number;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

/**
 * Where to put the rotated grid square for a `width × height` screen (plus `pad`
 * overscan on every side) and a grid cell of `size` screen px. `null` until the
 * screen has been measured.
 */
export function rotatedGridFrame(
	viewport: Viewport,
	width: number,
	height: number,
	pad: number,
	size: number,
): RotatedGridFrame | null {
	if (width <= 0 || height <= 0 || size <= 0) return null;
	const deg = viewportRotation(viewport);
	const rad = (deg * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	const cx = width / 2;
	const cy = height / 2;
	const side = Math.ceil(Math.hypot(width + 2 * pad, height + 2 * pad)) + 2;
	// t' = c + R⁻¹(t − c)
	const dx = viewport.x - cx;
	const dy = viewport.y - cy;
	const tx = cx + dx * cos + dy * sin;
	const ty = cy - dx * sin + dy * cos;
	// The square's local origin is at c − side/2 (in the unrotated frame).
	return {
		left: cx - side / 2,
		top: cy - side / 2,
		side,
		rotation: deg,
		offsetX: mod(tx - cx + side / 2, size),
		offsetY: mod(ty - cy + side / 2, size),
	};
}
