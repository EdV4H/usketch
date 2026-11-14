// The solids 3D shapes make on the ground (`collision` in their `view3d`) — what a walking
// character can't pass or can stand on. Pure, React-free, except the provider at the end.
//
// A character asks "how tall is the solid here?" and gets `null` (nothing), a finite top
// it can step or jump onto (`platform`), or `Infinity` (a wall: `solid`). Each shape's
// footprint follows its mode:
// - `box`: the whole rotated rectangle; a platform's top is the box's top.
// - `stand`, fixed facing: a thin band along the bottom edge (the stood-up plane).
// - `stand`, facing the camera: a small disc at the foot (the plane turns, so a fixed
//   band would not match it from every side).
// - `float`: nothing (it hangs above the ground).
import type { HeightProvider } from "./board-height.js";
import { defineService } from "./service.js";
import {
	resolveShapeView3d,
	type ShapeTypeView3d,
	type ShapeView3d,
	type ShapeView3dMode,
	shapeView3dCollision,
} from "./shape-view-3d.js";
import type { ShapeData } from "./types/shape.js";
import { safeRotation } from "./utils/rotation.js";

/** The foot of a stood-up shape: the middle of its (rotated) bottom edge, world units. */
export function shapeView3dFoot(shape: ShapeData): { x: number; y: number } {
	const rad = (safeRotation(shape.rotation) * Math.PI) / 180;
	const half = shape.height / 2;
	return {
		x: shape.x + shape.width / 2 - Math.sin(rad) * half,
		y: shape.y + shape.height / 2 + Math.cos(rad) * half,
	};
}

/** The point a 3D shape is placed by: the foot for `stand`, the centre otherwise. World units. */
export function shapeView3dAnchor(
	shape: ShapeData,
	mode: ShapeView3dMode,
): { x: number; y: number } {
	if (mode === "stand") return shapeView3dFoot(shape);
	return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
}

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

export interface ShapeView3dCollider {
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
export function colliderFor(shape: ShapeData, params: ShapeView3d): ShapeView3dCollider | null {
	const collision = shapeView3dCollision(params);
	if (collision === "none") return null;
	const w = Number.isFinite(shape.width) ? Math.abs(shape.width) : 0;
	const h = Number.isFinite(shape.height) ? Math.abs(shape.height) : 0;
	if (!(w > 0) || !(h > 0) || !Number.isFinite(shape.x) || !Number.isFinite(shape.y)) return null;
	const rot = safeRotation(shape.rotation);
	const at = shapeView3dAnchor(shape, params.mode);
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
	cells: ReadonlyMap<string, readonly ShapeView3dCollider[]>;
	/** Colliders too large for the grid, checked at every point. */
	large: readonly ShapeView3dCollider[];
	size: number;
}

const cellKey = (ix: number, iy: number) => `${ix},${iy}`;

/** Every shape's collider, bucketed in a grid so a point looks at few of them. Pure. */
export function buildColliderIndex(
	shapes: Iterable<ShapeData>,
	typeView3d: (type: string) => ShapeTypeView3d | undefined,
	cell = COLLIDER_CELL,
): ColliderIndex {
	const cells = new Map<string, ShapeView3dCollider[]>();
	const large: ShapeView3dCollider[] = [];
	let size = 0;
	for (const shape of shapes) {
		if (!shape || typeof shape.id !== "string") continue;
		const params = resolveShapeView3d(shape, typeView3d(shape.type));
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
	const visit = (list: readonly ShapeView3dCollider[] | undefined): boolean => {
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

// ── The board's shape solids (a solid provider on the board's height) ──

/** Options of {@link createShapeSolids}. */
export interface ShapeSolidsOptions {
	/** The board's shapes (replaced, never mutated, on a change: the index is cached on it). */
	shapes(): ReadonlyMap<string, ShapeData>;
	/** A shape type's 3D (`ctx.shapes.getView3d`). */
	typeView3d(type: string): ShapeTypeView3d | undefined;
	/** The ground's height, for platforms standing on it. */
	groundAt(x: number, y: number): number;
	/** How far the board is shown in 3D now (0 = flat), for {@link ShapeSolidsApi.setIn3dOnly}. */
	view3dAmount?(): number;
}

/** The board's shape solids (`shapeSolidsService`). */
export interface ShapeSolidsApi {
	/** The solid provider to register on the board's height. */
	readonly provider: HeightProvider;
	/** The tallest solid at a world point (see {@link solidHeightAt}). */
	heightAt(x: number, y: number): number | null;
	/** Only block while the board is shown in 3D (default: always). */
	setIn3dOnly(on: boolean): void;
	/**
	 * Read the shape types' 3D from here instead (e.g. the shape-3d plugin's table, which
	 * also covers types that don't declare it yet); `null` = back to the default.
	 * @deprecated Removed at the next major, with that table.
	 */
	setTypeView3d(
		read: ((type: string) => ShapeTypeView3d | undefined) | null,
		/** Changes whenever `read` would answer differently (the index is rebuilt then). */
		version?: () => unknown,
	): void;
	/** Rebuild the index on the next ask (e.g. after the type settings changed). */
	invalidate(): void;
}

/** The id of the shape solids' provider on the board's height. */
export const SHAPE_SOLIDS_PROVIDER_ID = "usketch:shape-solids";

/** The board's shape solids, provided by the core (absent with an older core). */
export const shapeSolidsService = defineService<ShapeSolidsApi>("usketch:shape-solids");

/** The board's shape solids (see {@link ShapeSolidsOptions}); register `provider` to use them. */
export function createShapeSolids(options: ShapeSolidsOptions): ShapeSolidsApi {
	let in3dOnly = false;
	let typeView3d = options.typeView3d;
	let typesVersion: () => unknown = () => undefined;
	let cache: {
		shapes: ReadonlyMap<string, ShapeData>;
		version: unknown;
		index: ColliderIndex;
	} | null = null;
	const index = (): ColliderIndex => {
		const shapes = options.shapes();
		const version = typesVersion();
		if (cache?.shapes !== shapes || cache.version !== version) {
			cache = { shapes, version, index: buildColliderIndex(shapes.values(), typeView3d) };
		}
		return cache.index;
	};
	const heightAt = (x: number, y: number): number | null => {
		if (in3dOnly && !((options.view3dAmount?.() ?? 0) > 0)) return null;
		return solidHeightAt(index(), x, y, options.groundAt);
	};
	return {
		provider: { id: SHAPE_SOLIDS_PROVIDER_ID, kind: "solid", heightAt },
		heightAt,
		setIn3dOnly(on) {
			in3dOnly = on;
		},
		setTypeView3d(read, version) {
			typeView3d = read ?? options.typeView3d;
			typesVersion = (read && version) || (() => undefined);
			cache = null;
		},
		invalidate() {
			cache = null;
		},
	};
}
