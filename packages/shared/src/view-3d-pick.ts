// What is under the pointer in a 3D view of the board: a 3D shape's face (nearest the
// eye), a flat shape lying on its ground, or the ground itself. Every 3D renderer draws
// shapes where `shapeView3dFaces` puts them, so one pick serves them all. Pure.
import {
	cameraEye,
	isOccluded,
	type ProjectionCamera,
	projectWorld,
	type StageSize,
	unprojectOnGround,
	unprojectWorld,
	type View3dProjection,
} from "./projection-3d.js";
import { defineService } from "./service.js";
import type { ShapeView3d } from "./shape-view-3d.js";
import {
	flatQuad3d,
	flatShapeView3dHeight,
	type Quad3d,
	shapeView3dFaces,
	type Vec3,
} from "./shape-view-3d-faces.js";
import type { Point, Viewport } from "./types/geometry.js";
import type { ShapeData } from "./types/shape.js";
import { safeRotation } from "./utils/rotation.js";
import type { View3dState } from "./view-3d-state.js";

/** The camera a 3D view state is drawn with, as the projection functions take it. Pure. */
export function view3dCamera(state: View3dState, zoom: number): ProjectionCamera {
	const a = Math.min(1, Math.max(0, Number.isFinite(state.amount) ? state.amount : 0));
	const { pitch, fov, horizon, height } = state.camera;
	const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
	return { pitch: pitch * a, yaw: 0, fov, horizon, heightPx: height * z * a };
}

/** The projection of a 3D view state on a stage. Pure. */
export function view3dProjection(
	state: View3dState,
	viewport: Viewport,
	stage: StageSize,
): View3dProjection {
	return { viewport, camera: view3dCamera(state, viewport.zoom), stage };
}

/** What a pick found. */
export interface View3dPick {
	/** A world point on the board: inside the picked shape's own box, or on the ground. */
	point: Point;
	/** The height (world units) of what was hit there. */
	height: number;
	/** The shape under the pointer, or `null` for the ground. */
	shapeId: string | null;
}

export interface View3dPickInput {
	/** Stage px. */
	x: number;
	y: number;
	view: View3dProjection;
	/** The shapes drawn, in z-order (bottom first). */
	shapes: readonly ShapeData[];
	/** The shapes drawn in 3D now, with their parameters (none: all lie flat). */
	view3d?: ReadonlyMap<string, ShapeView3d>;
	/** How far into 3D the view is (0 … 1). Default 1. */
	amount?: number;
	/** The camera's full yaw (deg), for shapes facing the camera. Default 0. */
	yaw?: number;
	/** Whether a world point is on a (flat) shape, as its type tests it. */
	hitTest(shape: ShapeData, point: Point): boolean;
	/** The ground's height (world units). Default: flat. */
	groundAt?: (x: number, y: number) => number;
	/** The ground's highest point to look for (world units). Default 1000. */
	maxGround?: number;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0],
];

/**
 * The view ray through a stage point: the eye and a direction (world units, height up).
 * `null` when the point shows nothing (the stage edge of a degenerate view). Pure.
 */
export function view3dRay(
	x: number,
	y: number,
	view: View3dProjection,
): { eye: Vec3; dir: Vec3 } | null {
	const e = cameraEye(view);
	const eye: Vec3 = [e.x, e.y, e.height];
	for (const h of [0, e.height * 2 + 100, -1000]) {
		const p = unprojectWorld(x, y, view, h);
		if (!p) continue;
		const dir = sub([p.x, p.y, h], eye);
		if (Math.hypot(dir[0], dir[1], dir[2]) > 1e-9) return { eye, dir };
	}
	return null;
}

/**
 * Where a ray meets a quad: the distance along the ray (in ray lengths) and the quad's
 * own coordinates (0 … 1 across `u` and `v`), or `null` when it misses. Pure.
 */
export function rayQuad(
	ray: { eye: Vec3; dir: Vec3 },
	q: Quad3d,
): { t: number; s: number; r: number } | null {
	const n = cross(q.u, q.v);
	const denom = dot(n, ray.dir);
	if (Math.abs(denom) < 1e-12) return null;
	const t = dot(n, sub(q.at, ray.eye)) / denom;
	if (!(t > 0)) return null;
	const hit: Vec3 = [
		ray.eye[0] + ray.dir[0] * t,
		ray.eye[1] + ray.dir[1] * t,
		ray.eye[2] + ray.dir[2] * t,
	];
	const d = sub(hit, q.at);
	const uu = dot(q.u, q.u);
	const vv = dot(q.v, q.v);
	if (!(uu > 0) || !(vv > 0)) return null;
	const s = dot(d, q.u) / uu;
	const r = dot(d, q.v) / vv;
	if (s < 0 || s > 1 || r < 0 || r > 1) return null;
	return { t, s, r };
}

/** A point of a shape's own box (`s`, `r` across its width and height), in the world. */
function boxPoint(shape: ShapeData, s: number, r: number): Point {
	const cx = shape.x + shape.width / 2;
	const cy = shape.y + shape.height / 2;
	const lx = (s - 0.5) * shape.width;
	const ly = (r - 0.5) * shape.height;
	const rad = (safeRotation(shape.rotation) * Math.PI) / 180;
	const c = Math.cos(rad);
	const n = Math.sin(rad);
	return { x: cx + lx * c - ly * n, y: cy + lx * n + ly * c };
}

/**
 * What is under a stage point in a 3D view: the nearest face of a shape standing in 3D
 * (not hidden by the ground), else the topmost flat shape (each on the ground under its
 * centre, as drawn), else the ground. A face maps back to the point of the shape's own
 * box it shows, so the shape's ordinary hit test finds it there. `null` for the sky. Pure.
 */
export function pickView3d(input: View3dPickInput): View3dPick | null {
	const { x, y, view, shapes } = input;
	const groundAt = input.groundAt ?? (() => 0);
	const amount = input.amount ?? 1;
	const ray = view3dRay(x, y, view);
	const rotation = view.viewport.rotation ?? 0;
	let best: { t: number; pick: View3dPick } | null = null;
	const flat: ShapeData[] = [];
	for (const shape of shapes) {
		if (shape.hidden) continue;
		const params = input.view3d?.get(shape.id);
		if (!params) {
			flat.push(shape);
			continue;
		}
		const at = { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
		const faces = shapeView3dFaces(shape, params, {
			amount,
			yaw: input.yaw ?? 0,
			viewportRotation: rotation,
			groundHeight: params.ground ? groundAt(at.x, at.y) : 0,
			pad: 0,
		});
		if (faces.flat) {
			flat.push(shape);
			continue;
		}
		if (!ray) continue;
		const hit = rayQuad(ray, faces.picture);
		const candidates: { t: number; point: Point }[] = [];
		if (hit) candidates.push({ t: hit.t, point: boxPoint(shape, hit.s, hit.r) });
		for (const wall of faces.walls) {
			const w = rayQuad(ray, wall.quad);
			// A wall shows the side of the box: it stands for the whole shape.
			if (w) candidates.push({ t: w.t, point: boxPoint(shape, 0.5, 0.5) });
		}
		for (const c of candidates) {
			if (best && c.t >= best.t) continue;
			const p: Vec3 = [
				ray.eye[0] + ray.dir[0] * c.t,
				ray.eye[1] + ray.dir[1] * c.t,
				ray.eye[2] + ray.dir[2] * c.t,
			];
			if (isOccluded({ x: p[0], y: p[1], height: p[2] }, view, groundAt)) continue;
			best = { t: c.t, pick: { point: c.point, height: p[2], shapeId: shape.id } };
		}
	}
	if (best) return best.pick;
	for (let i = flat.length - 1; i >= 0; i--) {
		const shape = flat[i];
		const h = flatShapeView3dHeight(shape, groundAt);
		const p = unprojectWorld(x, y, view, h);
		if (p && input.hitTest(shape, p)) return { point: p, height: h, shapeId: shape.id };
	}
	const g = unprojectOnGround(x, y, view, groundAt, {
		maxHeight: input.groundAt ? (input.maxGround ?? 1000) : 0,
		minHeight: 0,
	});
	return g ? { point: { x: g.x, y: g.y }, height: g.height, shapeId: null } : null;
}

/**
 * Follows a drag in a 3D view: the pointer's world point at the height it went down at,
 * kept at the same offset from the point first picked (so a stood-up shape picked by its
 * face moves with the ground under the pointer, without a jump). Pure.
 */
export function view3dDragPoint(
	x: number,
	y: number,
	view: View3dProjection,
	start: { height: number; offset: Point },
): Point | null {
	const p = unprojectWorld(x, y, view, start.height);
	return p ? { x: p.x + start.offset.x, y: p.y + start.offset.y } : null;
}

/** The view a shape's drawn quad is placed for (see {@link shapeView3dQuad}). */
export interface ShapeView3dQuadView {
	/** How far into 3D the view is (0 … 1). */
	amount: number;
	/** The camera's full yaw (deg), for shapes facing the camera. */
	yaw: number;
	/** The viewport's rotation (deg). */
	viewportRotation: number;
	/** The ground's height (world units). */
	groundAt(x: number, y: number): number;
}

/**
 * The quad a shape is drawn on in a 3D view (world units, height up): the face with the
 * drawing of a shape standing in 3D (`params`), else the shape lying flat on the ground
 * under its centre — where the pick finds it. Pure.
 */
export function shapeView3dQuad(
	shape: ShapeData,
	params: ShapeView3d | undefined,
	view: ShapeView3dQuadView,
): Quad3d {
	const cx = shape.x + shape.width / 2;
	const cy = shape.y + shape.height / 2;
	if (params) {
		const faces = shapeView3dFaces(shape, params, {
			amount: view.amount,
			yaw: view.yaw,
			viewportRotation: view.viewportRotation,
			groundHeight: params.ground ? view.groundAt(cx, cy) : 0,
			pad: 0,
		});
		if (!faces.flat) return faces.picture;
	}
	const rad = (safeRotation(shape.rotation) * Math.PI) / 180;
	return flatQuad3d(
		cx,
		cy,
		flatShapeView3dHeight(shape, view.groundAt),
		shape.width,
		shape.height,
		rad,
	);
}

/**
 * A world quad's corners on the stage (px), in order: its top-left, top-right,
 * bottom-right, bottom-left. `null` when a corner is behind the eye. Pure.
 */
export function projectQuad3d(q: Quad3d, view: View3dProjection): Point[] | null {
	const corners: Vec3[] = [
		q.at,
		[q.at[0] + q.u[0], q.at[1] + q.u[1], q.at[2] + q.u[2]],
		[q.at[0] + q.u[0] + q.v[0], q.at[1] + q.u[1] + q.v[1], q.at[2] + q.u[2] + q.v[2]],
		[q.at[0] + q.v[0], q.at[1] + q.v[1], q.at[2] + q.v[2]],
	];
	const out: Point[] = [];
	for (const c of corners) {
		const p = projectWorld(c[0], c[1], view, c[2]);
		if (!p) return null;
		out.push({ x: p.x, y: p.y });
	}
	return out;
}

/** A stretch of a shape's outline on the stage: in view, or hidden behind the ground. */
export interface OutlineRun {
	/** Stage px, in order along the outline. */
	points: Point[];
	/** The ground hides this stretch from the eye. */
	hidden: boolean;
	/** The whole outline in one run (its last point joins its first). */
	closed: boolean;
}

/**
 * A world quad's outline on the stage (px), cut where the ground hides it from the eye:
 * each edge is split into `perEdge` pieces and a piece is hidden when the ground rises
 * over the line of sight at its middle. Without `groundAt`, one closed run in view.
 * `null` when a point of it is behind the eye. Pure.
 */
export function quadOutlineRuns(
	q: Quad3d,
	view: View3dProjection,
	groundAt?: (x: number, y: number) => number,
	opts: { perEdge?: number } = {},
): OutlineRun[] | null {
	const corners: Vec3[] = [
		q.at,
		[q.at[0] + q.u[0], q.at[1] + q.u[1], q.at[2] + q.u[2]],
		[q.at[0] + q.u[0] + q.v[0], q.at[1] + q.u[1] + q.v[1], q.at[2] + q.u[2] + q.v[2]],
		[q.at[0] + q.v[0], q.at[1] + q.v[1], q.at[2] + q.v[2]],
	];
	const n = groundAt ? Math.max(1, Math.floor(opts.perEdge ?? 6)) : 1;
	const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [
		a[0] + (b[0] - a[0]) * t,
		a[1] + (b[1] - a[1]) * t,
		a[2] + (b[2] - a[2]) * t,
	];
	// The outline's points (a loop) and whether the piece after each one is hidden.
	const pts: Point[] = [];
	const hidden: boolean[] = [];
	for (let c = 0; c < 4; c++) {
		const a = corners[c] as Vec3;
		const b = corners[(c + 1) % 4] as Vec3;
		for (let k = 0; k < n; k++) {
			const w = lerp(a, b, k / n);
			const p = projectWorld(w[0], w[1], view, w[2]);
			if (!p) return null;
			pts.push({ x: p.x, y: p.y });
			if (!groundAt) {
				hidden.push(false);
				continue;
			}
			const m = lerp(a, b, (k + 0.5) / n);
			hidden.push(isOccluded({ x: m[0], y: m[1], height: m[2] }, view, groundAt));
		}
	}
	const count = pts.length;
	const start = hidden.findIndex((h, i) => h !== hidden[(i + count - 1) % count]);
	if (start < 0) return [{ points: pts, hidden: hidden[0] ?? false, closed: true }];
	// Start at a change, so no run is split where the loop begins.
	const runs: OutlineRun[] = [];
	for (let i = 0; i < count; i++) {
		const j = (start + i) % count;
		const state = hidden[j] as boolean;
		const last = runs[runs.length - 1];
		if (!last || last.hidden !== state) {
			runs.push({ points: [pts[j] as Point], hidden: state, closed: false });
		}
		(runs[runs.length - 1] as OutlineRun).points.push(pts[(j + 1) % count] as Point);
	}
	return runs;
}

/** What is under a point of the board's stage in its 3D view, as the canvas sees it. */
export interface View3dPickApi {
	/**
	 * What is under a stage point (px from the canvas's top-left) while the board is shown
	 * in 3D, or `null` when it is flat or the point shows only sky.
	 */
	pickAt(screen: Point): View3dPick | null;
	/**
	 * Where a shape is drawn on the stage while the board is shown in 3D: the corners (px
	 * from the canvas's top-left) of the face with its drawing, or of where it lies on the
	 * ground (see {@link shapeView3dQuad}). `null` when flat, unknown, or partly behind the
	 * eye. Optional: a canvas from before it has none.
	 */
	outlineOf?(shapeId: string): Point[] | null;
	/**
	 * The same outline cut where the ground hides it (see {@link quadOutlineRuns}).
	 * Optional: a canvas from before it has none.
	 */
	outlineRunsOf?(shapeId: string): OutlineRun[] | null;
}

/** The canvas's 3D pick (provided while a canvas is mounted). */
export const view3dPickService = defineService<View3dPickApi>("usketch:view-3d-pick");
