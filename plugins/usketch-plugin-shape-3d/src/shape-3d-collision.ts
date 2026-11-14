// What a 3D shape blocks on the ground (`collision` in its parameters) — pure, React-free.
//
// The plugin's solid provider on the board's height answers with this: a character walking the
// board asks "how tall is the solid here?" and gets `null` (nothing), a finite top it can
// step or jump onto (`platform`), or `Infinity` (a wall: `solid`). Each shape's footprint
// follows its mode:
// - `box`: the whole rotated rectangle; a platform's top is the box's top.
// - `stand`, fixed facing: a thin band along the bottom edge (the stood-up plane).
// - `stand`, facing the camera: a small disc at the foot (the plane turns, so a fixed
//   band would not match it from every side).
// - `float`: nothing (it hangs above the ground).
import { type ShapeData, safeRotation } from "@edv4h/usketch-shared";
import { shapeAnchor } from "./shape-3d-layout.js";
import {
	effectiveCollision,
	resolveShape3d,
	type Shape3dParams,
	type Shape3dTypes,
} from "./shape-3d-params.js";

/** Thickness of a fixed stood-up shape's wall, world units (centred on its bottom edge). */
export const STAND_WALL_THICKNESS = 8;
/** Smallest radius of a camera-facing stood-up shape's footprint, world units. */
export const MIN_STAND_RADIUS = 4;
/** Side of a grid cell of the collider index, world units. */
export const COLLIDER_CELL = 256;
/** Colliders spanning more cells than this skip the grid and are checked everywhere. */
const MAX_CELLS_PER_COLLIDER = 1024;

export type ColliderArea =
	| {
			kind: "rect";
			/** Centre, world units. */
			cx: number;
			cy: number;
			/** Half extents along the shape's own axes. */
			hw: number;
			hh: number;
			/** Of the shape's rotation (clockwise, y down). */
			cos: number;
			sin: number;
	  }
	| { kind: "circle"; cx: number; cy: number; r: number };

export interface Shape3dCollider {
	id: string;
	area: ColliderArea;
	/** `solid` = a wall (`Infinity`); `platform` = a top at `height` above its base. */
	collision: "solid" | "platform";
	/** World units above the base (platforms). */
	height: number;
	/** The base follows the terrain at the anchor (`ground`), else the board (0). */
	ground: boolean;
	/** Where the base is measured, world units. */
	ax: number;
	ay: number;
	/** Axis-aligned bounds, world units. */
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

function rectArea(cx: number, cy: number, hw: number, hh: number, deg: number): ColliderArea {
	const rad = (deg * Math.PI) / 180;
	return { kind: "rect", cx, cy, hw, hh, cos: Math.cos(rad), sin: Math.sin(rad) };
}

function areaBounds(a: ColliderArea): { minX: number; minY: number; maxX: number; maxY: number } {
	if (a.kind === "circle") {
		return { minX: a.cx - a.r, minY: a.cy - a.r, maxX: a.cx + a.r, maxY: a.cy + a.r };
	}
	const ex = Math.abs(a.cos) * a.hw + Math.abs(a.sin) * a.hh;
	const ey = Math.abs(a.sin) * a.hw + Math.abs(a.cos) * a.hh;
	return { minX: a.cx - ex, minY: a.cy - ey, maxX: a.cx + ex, maxY: a.cy + ey };
}

/** Whether a world point is inside an area (edges included). Pure. */
export function areaContains(a: ColliderArea, x: number, y: number): boolean {
	const dx = x - a.cx;
	const dy = y - a.cy;
	if (a.kind === "circle") return dx * dx + dy * dy <= a.r * a.r;
	const u = dx * a.cos + dy * a.sin;
	const v = -dx * a.sin + dy * a.cos;
	return Math.abs(u) <= a.hw && Math.abs(v) <= a.hh;
}

/** The collider of a shape with resolved 3D parameters, or `null` when it blocks nothing. Pure. */
export function colliderFor(shape: ShapeData, params: Shape3dParams): Shape3dCollider | null {
	const collision = effectiveCollision(params);
	if (collision === "none") return null;
	const w = Number.isFinite(shape.width) ? Math.abs(shape.width) : 0;
	const h = Number.isFinite(shape.height) ? Math.abs(shape.height) : 0;
	if (!(w > 0) || !(h > 0) || !Number.isFinite(shape.x) || !Number.isFinite(shape.y)) return null;
	const rot = safeRotation(shape.rotation);
	const at = shapeAnchor(shape, params.mode);
	let area: ColliderArea;
	if (params.mode === "box") {
		area = rectArea(shape.x + w / 2, shape.y + h / 2, w / 2, h / 2, rot);
	} else if (params.mode === "stand") {
		area =
			params.facing === "fixed"
				? rectArea(at.x, at.y, w / 2, STAND_WALL_THICKNESS / 2, rot)
				: { kind: "circle", cx: at.x, cy: at.y, r: Math.max(MIN_STAND_RADIUS, w / 4) };
	} else {
		return null;
	}
	return {
		id: shape.id,
		area,
		collision,
		height: params.height,
		ground: params.ground,
		ax: at.x,
		ay: at.y,
		...areaBounds(area),
	};
}

export interface ColliderIndex {
	/** Colliders by grid cell (`"ix,iy"`). */
	cells: ReadonlyMap<string, readonly Shape3dCollider[]>;
	/** Colliders too large for the grid, checked at every point. */
	large: readonly Shape3dCollider[];
	size: number;
}

const cellKey = (ix: number, iy: number) => `${ix},${iy}`;

/** Every shape's collider, bucketed in a grid so a point looks at few of them. Pure. */
export function buildColliderIndex(
	shapes: Iterable<ShapeData>,
	types: Shape3dTypes,
	cell = COLLIDER_CELL,
): ColliderIndex {
	const cells = new Map<string, Shape3dCollider[]>();
	const large: Shape3dCollider[] = [];
	let size = 0;
	for (const shape of shapes) {
		if (!shape || typeof shape.id !== "string") continue;
		const params = resolveShape3d(shape, types);
		if (!params) continue;
		const c = colliderFor(shape, params);
		if (!c) continue;
		size++;
		const x0 = Math.floor(c.minX / cell);
		const y0 = Math.floor(c.minY / cell);
		const x1 = Math.floor(c.maxX / cell);
		const y1 = Math.floor(c.maxY / cell);
		if ((x1 - x0 + 1) * (y1 - y0 + 1) > MAX_CELLS_PER_COLLIDER) {
			large.push(c);
			continue;
		}
		for (let ix = x0; ix <= x1; ix++) {
			for (let iy = y0; iy <= y1; iy++) {
				const key = cellKey(ix, iy);
				const list = cells.get(key);
				if (list) list.push(c);
				else cells.set(key, [c]);
			}
		}
	}
	return { cells, large, size };
}

/**
 * The tallest solid at a world point: `null` = none, `Infinity` = a wall, else a
 * platform's top (its base — the terrain at its anchor via `groundAt`, or 0 — plus its
 * height). A wall wins over any platform. Pure.
 */
export function solidHeightAt(
	index: ColliderIndex,
	x: number,
	y: number,
	groundAt: (x: number, y: number) => number,
	cell = COLLIDER_CELL,
): number | null {
	if (index.size === 0 || !Number.isFinite(x) || !Number.isFinite(y)) return null;
	let top: number | null = null;
	const visit = (list: readonly Shape3dCollider[] | undefined): boolean => {
		if (!list) return false;
		for (const c of list) {
			if (x < c.minX || x > c.maxX || y < c.minY || y > c.maxY) continue;
			if (!areaContains(c.area, x, y)) continue;
			if (c.collision === "solid") return true;
			const base = c.ground ? groundAt(c.ax, c.ay) : 0;
			const t = (Number.isFinite(base) ? base : 0) + c.height;
			if (top === null || t > top) top = t;
		}
		return false;
	};
	if (visit(index.large)) return Number.POSITIVE_INFINITY;
	if (visit(index.cells.get(cellKey(Math.floor(x / cell), Math.floor(y / cell))))) {
		return Number.POSITIVE_INFINITY;
	}
	return top;
}
