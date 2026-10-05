import { type Viewport, worldToScreen } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { rotatedGridFrame } from "../grid-frame.js";

const W = 800;
const H = 600;

/** Screen position of a point given in the rotated square's local coordinates. */
function squareToScreen(
	f: NonNullable<ReturnType<typeof rotatedGridFrame>>,
	lx: number,
	ly: number,
): { x: number; y: number } {
	const rad = (f.rotation * Math.PI) / 180;
	const cx = f.left + f.side / 2;
	const cy = f.top + f.side / 2;
	const dx = lx - f.side / 2;
	const dy = ly - f.side / 2;
	return {
		x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
		y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
	};
}

describe("rotatedGridFrame", () => {
	it("is null until the screen is measured", () => {
		expect(rotatedGridFrame({ x: 0, y: 0, zoom: 1, rotation: 30 }, 0, 0, 0, 20)).toBeNull();
	});

	it("covers the whole (padded) screen at any angle", () => {
		const f = rotatedGridFrame({ x: 0, y: 0, zoom: 1, rotation: 45 }, W, H, 50, 20);
		expect(f).not.toBeNull();
		if (!f) return;
		expect(f.side).toBeGreaterThanOrEqual(Math.hypot(W + 100, H + 100));
		expect(f.left + f.side / 2).toBe(W / 2);
		expect(f.top + f.side / 2).toBe(H / 2);
	});

	it("puts grid lines on world multiples of the cell size", () => {
		const cell = 20;
		for (const rotation of [30, -75, 160]) {
			for (const zoom of [1, 1.7]) {
				const vp: Viewport = { x: 1234.5, y: -987.25, zoom, rotation };
				const size = cell * zoom;
				const f = rotatedGridFrame(vp, W, H, 0, size);
				if (!f) throw new Error("frame");
				// A grid intersection inside the square: phase + k·size on both axes.
				const k = 7;
				const s = squareToScreen(f, f.offsetX + k * size, f.offsetY + k * size);
				// Map that screen point back to the world: it must be a cell multiple.
				const rad = (rotation * Math.PI) / 180;
				const dx = s.x - vp.x;
				const dy = s.y - vp.y;
				const wx = (dx * Math.cos(rad) + dy * Math.sin(rad)) / zoom;
				const wy = (-dx * Math.sin(rad) + dy * Math.cos(rad)) / zoom;
				const rem = (v: number) => Math.abs(v / cell - Math.round(v / cell));
				expect(rem(wx)).toBeLessThan(1e-6);
				expect(rem(wy)).toBeLessThan(1e-6);
				// Sanity: worldToScreen of that world point is the same screen point.
				const back = worldToScreen(wx, wy, vp);
				expect(back.x).toBeCloseTo(s.x, 6);
				expect(back.y).toBeCloseTo(s.y, 6);
			}
		}
	});
});
