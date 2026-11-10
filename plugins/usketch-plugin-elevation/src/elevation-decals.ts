// Ground decals (shared's `groundDecals`) painted into the elevation's ground, tile by
// tile: the flat layer lays a decal bitmap over each ground tile, and the 3D mesh maps
// it onto the raised surface as a texture, so a decal follows every slope and hides
// behind hills. Pure helpers (no WebGL / React here): the bitmap size, the paint, the
// texture mapping.
import type {
	GroundDecalApi,
	GroundDecalRect,
	GroundDecalView,
	Viewport,
} from "@edv4h/usketch-shared";
import { worldToScreen } from "@edv4h/usketch-shared";
import { type MeshCamera, projectLifted } from "./elevation-mesh.js";

/** Bitmap px a decal tile reaches past each edge, so sampling at a tile's edge meets its neighbour. */
export const DECAL_MARGIN = 2;
/** Smallest decal bitmap (px along a side, before the margin). */
export const DECAL_MIN_PX = 64;
/**
 * Largest decal bitmap. Near ground under a 3D view is magnified, so allow more than
 * the flat layer's 512 there; only tiles that hold decals get a bitmap at all.
 */
export const DECAL_MAX_PX = 1024;

/** A power of two from {@link DECAL_MIN_PX} to `max` for a tile shown about `screenPx` wide. Pure. */
export function decalTilePx(screenPx: number, max = DECAL_MAX_PX): number {
	let px = DECAL_MIN_PX;
	const want = Number.isFinite(screenPx) ? screenPx : max;
	while (px < max && px < want * 0.9) px *= 2;
	return px;
}

/** A ground tile's world rect. Pure. */
export function tileWorldRect(tx: number, ty: number, worldSize: number): GroundDecalRect {
	return {
		left: tx * worldSize,
		top: ty * worldSize,
		right: (tx + 1) * worldSize,
		bottom: (ty + 1) * worldSize,
	};
}

/**
 * The px a tile spans on screen under a 3D view: the larger side of the box around its
 * four corners projected at ground level (`z` world units, e.g. its mean height). A
 * corner at or behind the eye counts as huge (the tile is right under the camera). Pure.
 */
export function projectedTilePx(
	rect: GroundDecalRect,
	z: number,
	vp: Viewport,
	cam: MeshCamera,
	size: { width: number; height: number },
): number {
	const xs: number[] = [];
	const ys: number[] = [];
	for (const [x, y] of [
		[rect.left, rect.top],
		[rect.right, rect.top],
		[rect.left, rect.bottom],
		[rect.right, rect.bottom],
	]) {
		const s = worldToScreen(x, y, vp);
		const p = projectLifted(s.x, s.y, z * vp.zoom, cam, size);
		if (!p) return Number.POSITIVE_INFINITY;
		xs.push(p.x);
		ys.push(p.y);
	}
	return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

/**
 * Paint the decals that reach a tile into `ctx` (a bitmap of `px + 2·DECAL_MARGIN`
 * square): cleared, then each decal in order, transformed to world units and clipped
 * to the tile plus its margin. A decal that throws is skipped (the rest still paint).
 * Returns how many decals painted. Pure apart from the drawing.
 */
export function paintDecalTile(
	ctx: CanvasRenderingContext2D,
	decals: GroundDecalApi,
	view: GroundDecalView,
	rect: GroundDecalRect,
	px: number,
): number {
	const full = px + 2 * DECAL_MARGIN;
	const s = px / (rect.right - rect.left);
	const m = DECAL_MARGIN / s;
	const area = {
		left: rect.left - m,
		top: rect.top - m,
		right: rect.right + m,
		bottom: rect.bottom + m,
	};
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, full, full);
	let painted = 0;
	for (const { decal } of decals.listFor(view, area)) {
		ctx.save();
		ctx.setTransform(s, 0, 0, s, DECAL_MARGIN - rect.left * s, DECAL_MARGIN - rect.top * s);
		ctx.beginPath();
		ctx.rect(area.left, area.top, area.right - area.left, area.bottom - area.top);
		ctx.clip();
		try {
			decal.paint(ctx, { rect: area, pxPerUnit: s, view });
			painted++;
		} catch {
			// A broken decal must not take the ground down with it.
		}
		ctx.restore();
	}
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	return painted;
}

/**
 * Texture coordinates of a tile's decal bitmap from a point's offset in the tile (world
 * units from its corner): `uv = local · scale + offset`, the same along both axes. Pure.
 */
export function decalTexMapping(worldSize: number, px: number): { scale: number; offset: number } {
	const full = px + 2 * DECAL_MARGIN;
	return { scale: px / worldSize / full, offset: DECAL_MARGIN / full };
}
