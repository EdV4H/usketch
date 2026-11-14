// The projection of a 3D view of the board (Mode 7 style): one set of pure functions
// for every place that has to agree on where a point is drawn — the CSS tilt of the
// board layers, a WebGL / WebGPU vertex shader, and code that puts things on the ground
// or picks the ground under the pointer. React- and DOM-free.
//
// The view tilts the flat stage (the canvas container, px) with
//   perspective(fov) rotateX(pitch) rotateZ(yaw)   about (width/2, height·horizon)
// and lowers everything by the camera height (`heightPx`, applied first, along the
// board's normal). A point `z` px off the ground (a depth layer's `translateZ`) is
// raised toward the viewer. World points reach the flat stage through the viewport
// (`worldToScreen`), their height through the zoom (`z = height × zoom`).
import type { Point, Viewport } from "./types/geometry.js";
import { screenToWorld, viewportRotation, worldToScreen } from "./utils/geometry.js";

/** A 3D view's camera as drawn (degrees / px). See `View3dCamera`. */
export interface ProjectionCamera {
	/** Ground tilt in degrees (0 = straight down). */
	pitch: number;
	/** Spin of the ground in degrees, about the pivot. */
	yaw: number;
	/** CSS `perspective()` distance in px. */
	fov: number;
	/** The pivot line as a fraction of the stage height. */
	horizon: number;
	/** Px the camera is raised above the board (everything is drawn this much lower). Default 0. */
	heightPx?: number;
}

/** The stage (canvas container) size in px. */
export interface StageSize {
	width: number;
	height: number;
}

/** Everything a world ↔ screen projection needs. */
export interface View3dProjection {
	viewport: Viewport;
	camera: ProjectionCamera;
	stage: StageSize;
}

/** A point as seen through the tilt. */
export interface GroundProjection {
	/** Screen position, px from the stage's top-left. */
	x: number;
	y: number;
	/** Height toward the viewer, px (larger = nearer). Use it for draw order. */
	depth: number;
	/** Apparent scale at this point (1 / w). 1 on a flat (pitch 0) view. */
	scale: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** The tilt's pivot, px from the stage's top-left. */
export function tiltOrigin(cam: ProjectionCamera, size: StageSize): Point {
	return { x: size.width / 2, y: size.height * cam.horizon };
}

/**
 * A flat-stage point (px, before the tilt) `z` px off the ground, as drawn on screen.
 * `null` when it is at or behind the eye (very near points far below the pivot, where
 * the ground tips up past the viewer). Far points only approach the vanishing line.
 */
export function projectStagePoint(
	x: number,
	y: number,
	cam: ProjectionCamera,
	size: StageSize,
	z = 0,
): GroundProjection | null {
	const o = tiltOrigin(cam, size);
	const x0 = x - o.x;
	const y0 = y - o.y;
	const cosYaw = Math.cos(rad(cam.yaw));
	const sinYaw = Math.sin(rad(cam.yaw));
	const x1 = x0 * cosYaw - y0 * sinYaw;
	const y1 = x0 * sinYaw + y0 * cosYaw;
	// rotateX(pitch) of (y1, h): y' = y·cos − h·sin, z' = y·sin + h·cos
	const cosPitch = Math.cos(rad(cam.pitch));
	const sinPitch = Math.sin(rad(cam.pitch));
	const h = z - (cam.heightPx ?? 0);
	const y2 = y1 * cosPitch - h * sinPitch;
	const z2 = y1 * sinPitch + h * cosPitch;
	const w = 1 - z2 / cam.fov;
	if (w <= 0) return null;
	return { x: o.x + x1 / w, y: o.y + y2 / w, depth: z2, scale: 1 / w };
}

/**
 * The flat-stage point (px, before the tilt) drawn at a screen point, for points `z` px
 * off the ground (default 0) — the inverse of {@link projectStagePoint}. `null` above
 * the vanishing line (no ground there) or where that height is at or behind the eye.
 */
export function unprojectStagePoint(
	x: number,
	y: number,
	cam: ProjectionCamera,
	size: StageSize,
	z = 0,
): Point | null {
	const o = tiltOrigin(cam, size);
	const px = x - o.x;
	const py = y - o.y;
	const cosPitch = Math.cos(rad(cam.pitch));
	const sinPitch = Math.sin(rad(cam.pitch));
	const h = z - (cam.heightPx ?? 0);
	const denominator = cosPitch + (py * sinPitch) / cam.fov;
	if (denominator <= 0) return null;
	// py·w = y1·cos − h·sin with w = 1 − (y1·sin + h·cos) / fov, solved for y1.
	const y1 = (py + h * sinPitch - (py * h * cosPitch) / cam.fov) / denominator;
	const w = 1 - (y1 * sinPitch + h * cosPitch) / cam.fov;
	if (w <= 0) return null;
	const x1 = px * w;
	const cosYaw = Math.cos(rad(cam.yaw));
	const sinYaw = Math.sin(rad(cam.yaw));
	return { x: o.x + x1 * cosYaw + y1 * sinYaw, y: o.y - x1 * sinYaw + y1 * cosYaw };
}

/**
 * A world point `height` world units above the board (default 0), as drawn on screen.
 * `null` at or behind the eye.
 */
export function projectWorld(
	x: number,
	y: number,
	view: View3dProjection,
	height = 0,
): GroundProjection | null {
	const s = worldToScreen(x, y, view.viewport);
	return projectStagePoint(s.x, s.y, view.camera, view.stage, height * view.viewport.zoom);
}

/**
 * The world point drawn at a screen point, for points `height` world units above the
 * board (default 0). `null` above the vanishing line or behind the eye.
 */
export function unprojectWorld(
	x: number,
	y: number,
	view: View3dProjection,
	height = 0,
): Point | null {
	const s = unprojectStagePoint(x, y, view.camera, view.stage, height * view.viewport.zoom);
	return s ? screenToWorld(s.x, s.y, view.viewport) : null;
}

/** Options for {@link unprojectOnGround}. */
export interface GroundRayOptions {
	/** Highest ground to look for (world units). Default 0. */
	maxHeight?: number;
	/** Lowest ground to look for (world units). Default 0. */
	minHeight?: number;
	/** Samples between them before refining (default 64). */
	steps?: number;
}

/**
 * The first ground point the view ray through a screen point meets, on uneven ground
 * (`heightAt(x, y)` in world units, e.g. `groundHeightService`). The ray is followed
 * from `maxHeight` down to `minHeight`; the first place it passes below the ground is
 * refined by bisection. On flat ground (`maxHeight === minHeight`) this is
 * {@link unprojectWorld} at that height. `null` when the ray meets no ground in range
 * (sky, or behind the eye).
 */
export function unprojectOnGround(
	x: number,
	y: number,
	view: View3dProjection,
	heightAt: (x: number, y: number) => number,
	opts: GroundRayOptions = {},
): (Point & { height: number }) | null {
	const top = opts.maxHeight ?? 0;
	const bottom = Math.min(opts.minHeight ?? 0, top);
	const at = (h: number) => unprojectWorld(x, y, view, h);
	if (top === bottom) {
		const p = at(top);
		return p ? { ...p, height: top } : null;
	}
	// Above-ground margin at height h: > 0 while the ray is still above the ground.
	const margin = (h: number): number | null => {
		const p = at(h);
		return p ? h - heightAt(p.x, p.y) : null;
	};
	const steps = Math.max(2, Math.floor(opts.steps ?? 64));
	let prevH = top;
	let prevM = margin(top);
	if (prevM !== null && prevM <= 0) {
		const p = at(top);
		return p ? { ...p, height: heightAt(p.x, p.y) } : null;
	}
	for (let i = 1; i <= steps; i++) {
		const h = top + ((bottom - top) * i) / steps;
		const m = margin(h);
		if (m !== null && m <= 0 && prevM === null) {
			// The ray only comes into view at this height: no bracket to refine.
			const p = at(h);
			return p ? { ...p, height: heightAt(p.x, p.y) } : null;
		}
		if (m !== null && m <= 0 && prevM !== null) {
			// Crossed the ground between prevH (above) and h (below): bisect.
			let hi = prevH;
			let lo = h;
			for (let k = 0; k < 24; k++) {
				const mid = (hi + lo) / 2;
				const mm = margin(mid);
				if (mm === null || mm <= 0) lo = mid;
				else hi = mid;
			}
			const p = at(hi);
			return p ? { ...p, height: heightAt(p.x, p.y) } : null;
		}
		prevH = h;
		prevM = m;
	}
	return null;
}

/** CSS for a tilted layer: `transform` (with its own perspective) and its pivot. */
export interface TiltCss {
	transform: string;
	transformOrigin: string;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * The CSS tilt of a board layer: `perspective(fov) rotateX(pitch) rotateZ(yaw)` about
 * the horizon line. The camera height is NOT included (it changes every frame while a
 * follower climbs; apply it as a trailing `translateZ(-heightPx)`, e.g. via a CSS
 * variable).
 */
export function tiltCss(cam: ProjectionCamera): TiltCss {
	return {
		transform: `perspective(${round3(cam.fov)}px) rotateX(${round3(cam.pitch)}deg) rotateZ(${round3(cam.yaw)}deg)`,
		transformOrigin: `50% ${round3(cam.horizon * 100)}%`,
	};
}

/** A 4×4 matrix, column-major (as `uniformMatrix4fv` takes it). */
export type Mat4 = Float32Array;

/** Column-major multiply `a · b` in doubles. */
function mul(a: number[], b: number[]): number[] {
	const out = new Array<number>(16);
	for (let c = 0; c < 4; c++) {
		for (let r = 0; r < 4; r++) {
			let s = 0;
			for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
			out[c * 4 + r] = s;
		}
	}
	return out;
}

/** Column-major from rows (easier to read). */
function rows(m: number[][]): number[] {
	const out = new Array<number>(16);
	for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) out[c * 4 + r] = m[r][c];
	return out;
}

/**
 * The view as a matrix for a vertex shader: `M · (x, y, height, 1)` with world
 * coordinates gives `(X, Y, D, W)` where `(X / W, Y / W)` is the point in clip space
 * (−1…1, y up) — the same place {@link projectWorld} puts it — `W` is the perspective
 * divisor (> 0 in front of the eye) and `D` is its depth toward the viewer in px
 * (larger = nearer; the shader maps it to `gl_Position.z` as it likes, e.g.
 * `clamp(-D / range, -1, 1) * W`).
 *
 * `origin` (world) shifts the input so vertices can be given relative to it (e.g. a
 * terrain tile's corner): the matrix is built in doubles, so large world coordinates
 * don't lose float32 precision in the shader.
 */
export function viewMatrix(view: View3dProjection, origin: Point = { x: 0, y: 0 }): Mat4 {
	const { viewport: vp, camera: cam, stage } = view;
	const zoom = vp.zoom;
	const r = rad(viewportRotation(vp));
	const o = tiltOrigin(cam, stage);
	const s0 = worldToScreen(origin.x, origin.y, vp);
	// world (relative to origin) → flat stage px relative to the pivot, height px − camera
	const toStage = rows([
		[zoom * Math.cos(r), -zoom * Math.sin(r), 0, s0.x - o.x],
		[zoom * Math.sin(r), zoom * Math.cos(r), 0, s0.y - o.y],
		[0, 0, zoom, -(cam.heightPx ?? 0)],
		[0, 0, 0, 1],
	]);
	const cy = Math.cos(rad(cam.yaw));
	const sy = Math.sin(rad(cam.yaw));
	const yawM = rows([
		[cy, -sy, 0, 0],
		[sy, cy, 0, 0],
		[0, 0, 1, 0],
		[0, 0, 0, 1],
	]);
	const cp = Math.cos(rad(cam.pitch));
	const sp = Math.sin(rad(cam.pitch));
	// (x1, y1, h) → (x1, y2, z2, w): y2 = y1·cos − h·sin, z2 = y1·sin + h·cos, w = 1 − z2/fov
	const pitchM = rows([
		[1, 0, 0, 0],
		[0, cp, -sp, 0],
		[0, sp, cp, 0],
		[0, -sp / cam.fov, -cp / cam.fov, 1],
	]);
	// screen = pivot + (x1, y2) / w → clip: X = x1·2/W + w·(2·ox/W − 1), Y = −y2·2/H + w·(1 − 2·oy/H)
	const clip = rows([
		[2 / stage.width, 0, 0, (2 * o.x) / stage.width - 1],
		[0, -2 / stage.height, 0, 1 - (2 * o.y) / stage.height],
		[0, 0, 1, 0],
		[0, 0, 0, 1],
	]);
	return new Float32Array(mul(clip, mul(pitchM, mul(yawM, toStage))));
}
