// The elevation in a 3D view (Mode 7) as a real surface: per tile a grid of vertices
// lifted by their height, drawn by the mesh layer with the same projection the Mode 7
// CSS tilt applies to its layers — so the hills line up with the tilted board, the
// characters standing on them and the map. Pure helpers (no WebGL here): the
// projection, a tile's vertices, the colour ramp.
import { type ProjectionCamera, projectStagePoint } from "@edv4h/usketch-shared";
import { DEFAULT_GEN, type ElevationFieldConfig } from "./elevation-field.js";
import type { ElevationSampler } from "./elevation-model.js";
import { heightColor, shadeFactor } from "./elevation-shade.js";

/** The 3D view's camera as drawn (see `View3dCamera` in shared). Degrees / px. */
export type MeshCamera = ProjectionCamera;

/**
 * A point of the flat stage (px, before the tilt) raised `z` px toward the viewer, as
 * the Mode 7 tilt `perspective(fov) rotateX(pitch) rotateZ(yaw)` about
 * `(width/2, height·horizon)` shows it (`translateZ(z)` inside a depth layer). The
 * vertex shader uses the same projection (`viewMatrix`). `null` at or behind the eye.
 * Pure. Same as `projectStagePoint` in `@edv4h/usketch-shared` (argument order kept).
 */
export function projectLifted(
	x: number,
	y: number,
	z: number,
	cam: MeshCamera,
	size: { width: number; height: number },
): { x: number; y: number; depth: number } | null {
	const p = projectStagePoint(x, y, cam, size, z);
	return p ? { x: p.x, y: p.y, depth: p.depth } : null;
}

/** Floats per vertex: local x, local y (world units from the tile's corner), height, shade. */
export const VERTEX_FLOATS = 4;

/**
 * A tile's vertices: `(n + 1)²` points (the tile's samples and the first ones of its
 * right / bottom neighbours, so tiles meet without a gap), each with its height and the
 * shading of the surface there (from the slope of the drawn surface: water is flat at
 * its level). Positions are relative to the tile's corner, keeping them small for
 * float32. Pure.
 */
export function buildTileMesh(
	sampler: ElevationSampler,
	level: number,
	tx: number,
	ty: number,
): Float32Array {
	const field = sampler.field;
	const n = field.chunk;
	const step = 2 ** level;
	const water = field.waterLevel;
	const w = n + 3; // one ring around the vertices for the slopes
	const heights = new Float32Array(w * w);
	for (let lj = -1; lj <= n + 1; lj++) {
		for (let li = -1; li <= n + 1; li++) {
			heights[(lj + 1) * w + (li + 1)] = sampler.sample(
				(tx * n + li) * step,
				(ty * n + lj) * step,
				level,
			);
		}
	}
	const shown = (h: number) => (water !== null && h < water ? water : h);
	const span = 2 * step * field.spacing;
	const cell = step * field.spacing;
	const out = new Float32Array((n + 1) * (n + 1) * VERTEX_FLOATS);
	let o = 0;
	for (let lj = 0; lj <= n; lj++) {
		for (let li = 0; li <= n; li++) {
			const c = (lj + 1) * w + (li + 1);
			const h = heights[c];
			const gx = (shown(heights[c + 1]) - shown(heights[c - 1])) / span;
			const gy = (shown(heights[c + w]) - shown(heights[c - w])) / span;
			out[o++] = li * cell;
			out[o++] = lj * cell;
			out[o++] = h;
			out[o++] = water !== null && h < water ? 1 : shadeFactor(gx, gy);
		}
	}
	return out;
}

const indexCache = new Map<number, Uint16Array>();

/** Triangle indices of an `(n + 1)²` vertex grid (two triangles per cell). Pure, cached. */
export function tileIndices(n: number): Uint16Array {
	const hit = indexCache.get(n);
	if (hit) return hit;
	const out = new Uint16Array(n * n * 6);
	let o = 0;
	const row = n + 1;
	for (let j = 0; j < n; j++) {
		for (let i = 0; i < n; i++) {
			const a = j * row + i;
			out[o++] = a;
			out[o++] = a + 1;
			out[o++] = a + row;
			out[o++] = a + 1;
			out[o++] = a + row + 1;
			out[o++] = a + row;
		}
	}
	indexCache.set(n, out);
	return out;
}

/** Texels of the colour ramp. */
export const RAMP_WIDTH = 1024;

/** The heights the colour ramp spans, `0 … rampRange` (higher ground keeps the top colour). */
export function rampRange(field: ElevationFieldConfig): number {
	const relief = field.seed !== null ? field.gen.relief : DEFAULT_GEN.relief;
	return Math.max(1, relief, field.waterLevel ?? 0);
}

/** The colour by height as RGBA texels over `0 … rampRange(field)` (same colours as 2D). Pure. */
export function rampPixels(field: ElevationFieldConfig): Uint8Array {
	const range = rampRange(field);
	const relief = field.seed !== null ? field.gen.relief : DEFAULT_GEN.relief;
	const out = new Uint8Array(RAMP_WIDTH * 4);
	for (let k = 0; k < RAMP_WIDTH; k++) {
		const h = ((k + 0.5) / RAMP_WIDTH) * range;
		const [r, g, b] = heightColor(h, field.waterLevel, relief);
		out[k * 4] = Math.round(r);
		out[k * 4 + 1] = Math.round(g);
		out[k * 4 + 2] = Math.round(b);
		out[k * 4 + 3] = 255;
	}
	return out;
}
