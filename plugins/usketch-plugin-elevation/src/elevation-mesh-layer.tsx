// The elevation as a surface in a 3D view (Mode 7): one WebGL2 canvas over the stage,
// NOT tilted by Mode 7 — it projects its vertices itself with the same transform Mode 7
// gives its tilted layers (see `projectLifted`), so the hills sit exactly where the
// board, the characters and the map are drawn. Only while the view is (partly) 3D;
// meanwhile the flat ground layer is hidden. Without WebGL2 nothing is drawn here and
// the flat layer stays (its shading tilted with the board, as before).
//
// The canvas is one layer: DOM layers above it (shapes, characters) are drawn in front
// of the hills, even behind one. So that a hill hides the shapes behind it, a second,
// "cover" canvas over the shapes gets the hills again — only where the ground is nearer
// the eye than every shape drawn there (the shapes' faces, from the canvas's 3D pick,
// are drawn into the depth and stencil buffers first). Everywhere else it is clear.
import {
	type BoardStore,
	cameraEye,
	type GroundDecalApi,
	type Quad3d,
	type View3dApi,
	type View3dGlApi,
	type View3dGlDrawable,
	type View3dProjection,
	type View3dShapeFaces,
	type Viewport,
	view3dOverscanPx,
	viewMatrix,
} from "@edv4h/usketch-shared";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	DECAL_MARGIN,
	decalLookupArea,
	decalTexMapping,
	decalTileArea,
	nextDecalTilePx,
	paintDecalTile,
	projectedTilePx,
	tileWorldRect,
} from "./elevation-decals.js";
import { chunkKey } from "./elevation-field.js";
import { tileRevision } from "./elevation-layer.js";
import {
	buildTileMesh,
	type MeshCamera,
	RAMP_WIDTH,
	rampPixels,
	rampRange,
	tileIndices,
	VERTEX_FLOATS,
} from "./elevation-mesh.js";
import { boardElevation, type ElevationModel, elevationSampler } from "./elevation-model.js";
import type { ElevationDisplay } from "./elevation-shade.js";
import { planTiles, visibleWorldRect } from "./elevation-tiles.js";
import type { ReactiveStore } from "./reactive-store.js";

export const MESH_LAYER_ID = "usketch-elevation:mesh";

/** Whether the mesh is drawing the ground now (the flat layer hides meanwhile). */
export interface MeshState {
	drawing: boolean;
}

/** The layer with the cover canvas: the hills drawn again over the shapes they hide. */
export const COVER_LAYER_ID = "usketch-elevation:cover";

/** The cover canvas, while its layer is mounted. */
export interface CoverTarget {
	canvas: HTMLCanvasElement | null;
}

/** What the mesh needs to cover the shapes the hills hide. */
export interface MeshCover {
	target: ReactiveStore<CoverTarget>;
	/** The shapes' faces drawn in the 3D view now (the canvas's 3D pick). */
	faces: () => readonly View3dShapeFaces[];
}

/**
 * How much nearer the eye (px of depth) the ground must be than a shape to cover it: a
 * shape lying on the ground isn't swallowed by the ground just around it.
 */
export const COVER_DEPTH_BIAS = 6;

/** Most ground samples along a side of a lying face, to find how high the ground rises under it. */
const MAX_LIFT_SAMPLES = 17;

/**
 * How far the ground rises above a face lying flat (both its sides level), world units:
 * the highest of a grid of samples over it, above the face. `0` for a face that isn't
 * level. A lying shape is judged as if that much higher, so the slope it lies on doesn't
 * swallow it — only a hill between it and the eye covers it. Pure.
 */
export function coverLift(
	q: Quad3d,
	groundAt: (x: number, y: number) => number,
	/** World units between samples (the terrain's spacing); more past {@link MAX_LIFT_SAMPLES}. */
	step = 32,
): number {
	if (Math.abs(q.u[2]) > 1e-6 || Math.abs(q.v[2]) > 1e-6) return 0;
	const count = (len: number) =>
		Math.min(MAX_LIFT_SAMPLES, Math.max(2, Math.ceil(len / Math.max(1, step)) + 1));
	const nu = count(Math.hypot(q.u[0], q.u[1]));
	const nv = count(Math.hypot(q.v[0], q.v[1]));
	let top = Number.NEGATIVE_INFINITY;
	for (let i = 0; i < nu; i++) {
		for (let j = 0; j < nv; j++) {
			const a = i / (nu - 1);
			const b = j / (nv - 1);
			const h = groundAt(q.at[0] + q.u[0] * a + q.v[0] * b, q.at[1] + q.u[1] * a + q.v[1] * b);
			if (Number.isFinite(h) && h > top) top = h;
		}
	}
	return Number.isFinite(top) ? Math.max(0, top - q.at[2]) : 0;
}

/** Floats per cover vertex: where it is drawn (x, y, height), then where its depth is taken. */
export const COVER_VERTEX_FLOATS = 6;
/** Largest cell a face is cut into (world units), and most cells along a side. */
const COVER_CELL = 32;
const MAX_COVER_CELLS = 16;

/**
 * The triangles of the shapes' faces, 6 vertices per cell of a quad, each {@link COVER_VERTEX_FLOATS}
 * floats: where it is drawn — x, y relative to `origin`, height — then the point its
 * depth is taken at: the same, or for a lying face with {@link coverLift} above 0 the
 * point toward `eye` on its line of sight that is that much higher (drawn on the same
 * pixel, so the ground just around the face isn't nearer than it). Pure.
 */
export function coverVertices(
	faces: readonly View3dShapeFaces[],
	origin: { x: number; y: number },
	ground?: {
		/** A lying face's {@link coverLift}. */
		liftOf: (q: Quad3d) => number;
		/** The view's eye (`cameraEye`). */
		eye: { x: number; y: number; height: number };
	},
	/**
	 * Largest cell, world units: a face is cut into cells so its depth (linear in depth,
	 * as the mesh's) is right across it, not only at its corners.
	 */
	cell = COVER_CELL,
): Float32Array {
	const cells = (q: Quad3d) => {
		const n = (v: readonly number[]) =>
			Math.min(MAX_COVER_CELLS, Math.max(1, Math.ceil(Math.hypot(v[0], v[1], v[2]) / cell)));
		return { nu: n(q.u), nv: n(q.v) };
	};
	let n = 0;
	for (const f of faces) {
		for (const q of f.quads) {
			const { nu, nv } = cells(q);
			n += nu * nv;
		}
	}
	const out = new Float32Array(n * 6 * COVER_VERTEX_FLOATS);
	let i = 0;
	for (const f of faces) {
		for (const q of f.quads) {
			const lift = ground ? ground.liftOf(q) : 0;
			const corner = (a: number, b: number) => {
				const x = q.at[0] + q.u[0] * a + q.v[0] * b;
				const y = q.at[1] + q.u[1] * a + q.v[1] * b;
				const z = q.at[2] + q.u[2] * a + q.v[2] * b;
				out[i++] = x - origin.x;
				out[i++] = y - origin.y;
				out[i++] = z;
				let t = 0;
				if (ground && lift > 0) {
					const rise = ground.eye.height - z;
					t = rise > 0 ? Math.min(0.99, lift / rise) : 0;
				}
				const e = ground?.eye;
				out[i++] = (e ? x + (e.x - x) * t : x) - origin.x;
				out[i++] = (e ? y + (e.y - y) * t : y) - origin.y;
				out[i++] = e ? z + (e.height - z) * t : z;
			};
			const { nu, nv } = cells(q);
			for (let a = 0; a < nu; a++) {
				for (let b = 0; b < nv; b++) {
					const a0 = a / nu;
					const a1 = (a + 1) / nu;
					const b0 = b / nv;
					const b1 = (b + 1) / nv;
					corner(a0, b0);
					corner(a1, b0);
					corner(a1, b1);
					corner(a0, b0);
					corner(a1, b1);
					corner(a0, b1);
				}
			}
		}
	}
	return out;
}

/** Depth range in px: depth values are scaled by 1 / this into the depth buffer. */
const DEPTH_RANGE = 200_000;

const VERTEX = `#version 300 es
in vec4 aVertex; // local x, local y, height, shade
// The view (viewMatrix from @edv4h/usketch-shared) for this tile: takes world units
// relative to the tile's corner and gives clip x / y, the depth toward the viewer, w.
uniform mat4 uView;
uniform float uWater;  // < 0: none
out float vHeight;
out float vShade;
out vec2 vLocal;
void main() {
	float h = uWater >= 0.0 ? max(aVertex.z, uWater) : aVertex.z;
	vec4 p = uView * vec4(aVertex.xy, h, 1.0);
	// The divide by w is left to the GPU (so colours and heights are interpolated in
	// perspective); p.z is the depth toward the viewer in px.
	gl_Position = vec4(p.x, p.y, clamp(-p.z / ${DEPTH_RANGE.toFixed(1)}, -1.0, 1.0) * p.w, p.w);
	vHeight = aVertex.z;
	vShade = aVertex.w;
	vLocal = aVertex.xy;
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in float vHeight;
in float vShade;
in vec2 vLocal;
uniform sampler2D uRamp;
uniform float uRange;
uniform float uWater;
uniform float uContour;
uniform float uTint;
uniform float uShadeOn;
uniform float uFadeZero;
uniform sampler2D uDecal; // the tile's ground decals (premultiplied)
uniform float uDecalOn;
uniform vec2 uDecalMap;   // uv = local · x + y
out vec4 outColor;
void main() {
	vec3 c = uTint > 0.5 ? texture(uRamp, vec2(clamp(vHeight / uRange, 0.0, 1.0), 0.5)).rgb : vec3(0.86);
	bool under = uWater >= 0.0 && vHeight < uWater;
	bool lit = uShadeOn > 0.5 && !under;
	if (lit) c *= vShade;
	if (uContour > 0.0 && !under && vHeight > 0.0) {
		float t = vHeight / uContour;
		float d = abs(fract(t - 0.5) - 0.5) / max(fwidth(t), 1e-5);
		c *= mix(0.62, 1.0, clamp(d - 0.5, 0.0, 1.0));
	}
	// A field without generated terrain: flat ground (0) is see-through, as in 2D.
	float a = uFadeZero > 0.5 ? clamp(vHeight / 6.0, 0.0, 1.0) : 1.0;
	vec3 rgb = c * a;
	// Ground decals lie on the surface: shaded like it, over the colours and contours.
	if (uDecalOn > 0.5) {
		vec4 d = texture(uDecal, vLocal * uDecalMap.x + uDecalMap.y);
		vec3 dc = lit ? d.rgb * vShade : d.rgb;
		rgb = dc + rgb * (1.0 - d.a);
		a = d.a + a * (1.0 - d.a);
	}
	outColor = vec4(rgb, a);
}`;
const COVER_VERTEX = `#version 300 es
in vec3 aPos;      // x, y relative to the view's origin, height
in vec3 aDepthPos; // the point its depth is taken at (see coverVertices)
uniform mat4 uView;
uniform float uBias;
void main() {
	vec4 p = uView * vec4(aPos, 1.0);
	float depth = -(uView * vec4(aDepthPos, 1.0)).z - uBias;
	gl_Position = vec4(p.x, p.y, clamp(depth / ${DEPTH_RANGE.toFixed(1)}, -1.0, 1.0) * p.w, p.w);
}`;

const COVER_FRAGMENT = `#version 300 es
precision mediump float;
out vec4 outColor;
void main() {
	outColor = vec4(0.0);
}`;

interface TileMesh {
	revision: string;
	buffer: WebGLBuffer;
	used: number;
	/** The tile's mean drawn height (world units): where its decals are judged for size. */
	meanHeight: number;
}

/** A tile's decal texture and what it was painted from. */
interface DecalTexture {
	texture: WebGLTexture;
	/** Bitmap px (before the margin). */
	px: number;
	/** The decal registry's version when painted. */
	version: number;
	used: number;
	/** GPU bytes it holds (with its mipmaps), for the memory cap. */
	bytes: number;
}

/**
 * Decal bitmap texels (re)painted per frame at most — about one 1024² tile, or many
 * small far ones; the rest wait for the next frames. The first paint of a frame always
 * runs, so one large paint can exceed it (and then nothing else paints that frame).
 */
export const DECAL_TEXELS_PER_FRAME = 1_200_000;
/** …and no new paint starts after this long in a frame. */
const DECAL_FRAME_BUDGET_MS = 6;
/**
 * GPU bytes all decal textures may hold. Over it, the least recently drawn textures not
 * drawn this frame are dropped (they repaint when seen again).
 */
export const DECAL_TEXTURE_BYTES = 64 * 1024 * 1024;

/** Bytes of a decal texture of `px` (+ margin) with its mipmaps (≈ 4/3). */
const decalBytes = (px: number) => Math.ceil(((px + 2 * DECAL_MARGIN) ** 2 * 4 * 4) / 3);

/** The mean height of a tile's vertices (water drawn at its level). */
function meanHeight(vertices: Float32Array, water: number | null): number {
	let sum = 0;
	let n = 0;
	for (let i = 2; i < vertices.length; i += VERTEX_FLOATS) {
		const h = vertices[i];
		sum += water !== null && h < water ? water : h;
		n++;
	}
	return n > 0 ? sum / n : 0;
}

/** A linked program of two shader sources, its attributes at 0, 1, … Throws on failure. */
function linkProgram(
	gl: WebGL2RenderingContext,
	vertex: string,
	fragment: string,
	attributes: readonly string[],
): WebGLProgram {
	const shader = (type: number, src: string) => {
		const s = gl.createShader(type);
		if (!s) throw new Error("shader");
		gl.shaderSource(s, src);
		gl.compileShader(s);
		if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "");
		return s;
	};
	const program = gl.createProgram();
	if (!program) throw new Error("program");
	gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex));
	gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment));
	attributes.forEach((name, i) => {
		gl.bindAttribLocation(program, i, name);
	});
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error(gl.getProgramInfoLog(program) ?? "");
	}
	return program;
}

/** Owns the GL objects of one canvas. */
class MeshRenderer {
	private readonly gl: WebGL2RenderingContext;
	private readonly program: WebGLProgram;
	private readonly vao: WebGLVertexArrayObject;
	private readonly indexBuffer: WebGLBuffer;
	private indexChunk = 0;
	private readonly ramp: WebGLTexture;
	private rampKey = "";
	private readonly tiles = new Map<string, TileMesh>();
	private readonly decalTextures = new Map<string, DecalTexture>();
	private scratch: HTMLCanvasElement | null = null;
	private frame = 0;
	private readonly u: Record<string, WebGLUniformLocation | null> = {};
	/** The faces' program and buffer (built on first cover). */
	private cover: {
		program: WebGLProgram;
		vao: WebGLVertexArrayObject;
		buffer: WebGLBuffer;
		uView: WebGLUniformLocation | null;
		uBias: WebGLUniformLocation | null;
	} | null = null;
	/** The cover canvas holds a picture (cleared once nothing is covered). */
	private covered = false;
	/** Lying faces' lifts, for the terrain they were found on (shapes seldom move). */
	private lifts: { sampler: unknown; values: Map<string, number> } | null = null;

	static create(canvas: HTMLCanvasElement): MeshRenderer | null {
		const gl = canvas.getContext("webgl2", {
			antialias: true,
			premultipliedAlpha: true,
			// The shapes' faces mark where the cover may draw.
			stencil: true,
		});
		if (!gl) return null;
		return MeshRenderer.fromGl(gl);
	}

	/** On a context someone else owns (a GPU 3D renderer's): see {@link draw}'s `external`. */
	static fromGl(gl: WebGL2RenderingContext): MeshRenderer | null {
		try {
			return new MeshRenderer(gl);
		} catch {
			return null;
		}
	}

	private constructor(gl: WebGL2RenderingContext) {
		this.gl = gl;
		this.program = linkProgram(gl, VERTEX, FRAGMENT, ["aVertex"]);
		for (const name of [
			"uView",
			"uWater",
			"uRamp",
			"uRange",
			"uContour",
			"uTint",
			"uShadeOn",
			"uFadeZero",
			"uDecal",
			"uDecalOn",
			"uDecalMap",
		]) {
			this.u[name] = gl.getUniformLocation(this.program, name);
		}
		const vao = gl.createVertexArray();
		const ib = gl.createBuffer();
		const ramp = gl.createTexture();
		if (!vao || !ib || !ramp) throw new Error("gl objects");
		this.vao = vao;
		this.indexBuffer = ib;
		this.ramp = ramp;
		gl.bindTexture(gl.TEXTURE_2D, ramp);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	}

	draw(opts: {
		model: ElevationModel;
		viewport: Viewport;
		camera: MeshCamera;
		width: number;
		height: number;
		dpr: number;
		overscanPx: number;
		display: ElevationDisplay;
		store: BoardStore;
		/** Ground decals painted onto the surface (their `"3d"` view). */
		decals?: GroundDecalApi;
		/** Drawing into someone else's frame: leave its canvas size, viewport and buffers. */
		external?: boolean;
		/**
		 * Draw the hills that hide these shapes' faces into `canvas` first (see the file
		 * comment). Only on our own canvas (not `external`).
		 */
		cover?: { canvas: HTMLCanvasElement; faces: readonly View3dShapeFaces[] };
	}): boolean {
		let pending = false;
		const { gl, u } = this;
		const { model, viewport: vp, camera, width, height, display } = opts;
		const field = model.field;
		if (!opts.external) {
			const canvas = gl.canvas as HTMLCanvasElement;
			const pw = Math.max(1, Math.round(width * opts.dpr));
			const ph = Math.max(1, Math.round(height * opts.dpr));
			if (canvas.width !== pw || canvas.height !== ph) {
				canvas.width = pw;
				canvas.height = ph;
			}
			gl.viewport(0, 0, pw, ph);
			gl.clearColor(0, 0, 0, 0);
			gl.clearDepth(1);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		}
		const rect = visibleWorldRect(opts.store, opts.overscanPx);
		const plan = rect ? planTiles(field, rect, vp.zoom) : null;
		if (!plan) {
			if (opts.cover) this.clearCover(opts.cover.canvas);
			return false;
		}

		this.frame++;
		// biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook
		gl.useProgram(this.program);
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LEQUAL);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.bindVertexArray(this.vao);

		const n = field.chunk;
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
		if (this.indexChunk !== n) {
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, tileIndices(n), gl.STATIC_DRAW);
			this.indexChunk = n;
		}
		const range = rampRange(field);
		const rampKey = `${field.seed}|${field.gen.relief}|${field.waterLevel}`;
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.ramp);
		if (rampKey !== this.rampKey) {
			gl.texImage2D(
				gl.TEXTURE_2D,
				0,
				gl.RGBA,
				RAMP_WIDTH,
				1,
				0,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				rampPixels(field),
			);
			this.rampKey = rampKey;
		}

		const view: View3dProjection = { viewport: vp, camera, stage: { width, height } };
		gl.uniform1f(u.uWater, field.waterLevel ?? -1);
		gl.uniform1i(u.uRamp, 0);
		gl.uniform1f(u.uRange, range);
		gl.uniform1f(u.uContour, display.contour);
		gl.uniform1f(u.uTint, display.tint ? 1 : 0);
		gl.uniform1f(u.uShadeOn, display.shade ? 1 : 0);
		gl.uniform1f(u.uFadeZero, field.seed === null && field.waterLevel === null ? 1 : 0);
		gl.uniform1i(u.uDecal, 1);
		const decals = opts.decals;
		let texels = 0;
		const paintStart = performance.now();
		const canPaint = (cost: number) =>
			texels === 0 ||
			(texels + cost <= DECAL_TEXELS_PER_FRAME &&
				performance.now() - paintStart < DECAL_FRAME_BUDGET_MS);

		const sampler = elevationSampler(model);
		const fk = `${field.id}|${field.spacing}|${n}|${field.seed}|${field.waterLevel}|${field.gen.relief}|${field.gen.scale}|${field.gen.roughness}|${field.gen.ridges}|${field.gen.octaves}`;
		const count = n * n * 6;
		const drawTiles = (): void => {
			for (let ty = plan.ty0; ty <= plan.ty1; ty++) {
				for (let tx = plan.tx0; tx <= plan.tx1; tx++) {
					const key = `${plan.level}:${chunkKey(tx, ty)}`;
					const revision = `${fk}#${tileRevision(model, plan.level, tx, ty)}`;
					let tile = this.tiles.get(key);
					if (!tile || tile.revision !== revision) {
						const buffer = tile?.buffer ?? gl.createBuffer();
						if (!buffer) continue;
						gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
						const vertices = buildTileMesh(sampler, plan.level, tx, ty);
						gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
						tile = {
							revision,
							buffer,
							used: this.frame,
							meanHeight: meanHeight(vertices, field.waterLevel),
						};
						this.tiles.set(key, tile);
					}
					tile.used = this.frame;
					gl.bindBuffer(gl.ARRAY_BUFFER, tile.buffer);
					gl.enableVertexAttribArray(0);
					gl.vertexAttribPointer(0, VERTEX_FLOATS, gl.FLOAT, false, VERTEX_FLOATS * 4, 0);
					gl.uniformMatrix4fv(
						u.uView,
						false,
						viewMatrix(view, { x: tx * plan.worldSize, y: ty * plan.worldSize }),
					);
					const decal = decals
						? this.decalFor(decals, key, tx, ty, plan.worldSize, {
								vp,
								camera,
								width,
								height,
								dpr: opts.dpr,
								z: tile.meanHeight,
								canPaint,
								painted: (cost) => {
									texels += cost;
								},
							})
						: null;
					if (decal?.pending) pending = true;
					if (decal?.texture) {
						const map = decalTexMapping(plan.worldSize, decal.texture.px);
						gl.activeTexture(gl.TEXTURE1);
						gl.bindTexture(gl.TEXTURE_2D, decal.texture.texture);
						gl.uniform1f(u.uDecalOn, 1);
						gl.uniform2f(u.uDecalMap, map.scale, map.offset);
					} else {
						gl.uniform1f(u.uDecalOn, 0);
					}
					gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
				}
			}
		};

		if (opts.cover && !opts.external) {
			const { canvas: target, faces } = opts.cover;
			// The ground as drawn: water at its level.
			const water = field.waterLevel;
			const groundAt = (x: number, y: number): number => {
				const h = sampler.heightAt(x, y);
				return water !== null && h < water ? water : h;
			};
			if (
				faces.length > 0 &&
				this.drawCoverMask(faces, view, this.liftFor(sampler, groundAt, field.spacing))
			) {
				// The hills, only where the faces were and only nearer than them.
				// biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook
				gl.useProgram(this.program);
				gl.bindVertexArray(this.vao);
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
				gl.enable(gl.STENCIL_TEST);
				gl.stencilFunc(gl.EQUAL, 1, 0xff);
				gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
				gl.depthFunc(gl.LESS);
				gl.enable(gl.BLEND);
				drawTiles();
				gl.disable(gl.STENCIL_TEST);
				gl.depthFunc(gl.LEQUAL);
				this.copyCover(target);
				gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
			} else {
				this.clearCover(target);
			}
		}
		drawTiles();
		// Drop the meshes of tiles no longer drawn (a few frames' grace for panning back).
		for (const [key, tile] of this.tiles) {
			if (this.frame - tile.used > 120) {
				gl.deleteBuffer(tile.buffer);
				this.tiles.delete(key);
			}
		}
		this.dropDecalTextures();
		gl.activeTexture(gl.TEXTURE0);
		return pending;
	}

	/**
	 * The shapes' faces into the depth and stencil buffers (no colour): clears the frame,
	 * then marks each pixel a face covers with its nearest depth (nudged toward the eye by
	 * {@link COVER_DEPTH_BIAS}). `false` when the faces program can't be built.
	 */
	private drawCoverMask(
		faces: readonly View3dShapeFaces[],
		view: View3dProjection,
		liftOf: (q: Quad3d) => number,
	): boolean {
		const { gl } = this;
		if (!this.cover) {
			try {
				const program = linkProgram(gl, COVER_VERTEX, COVER_FRAGMENT, ["aPos", "aDepthPos"]);
				const vao = gl.createVertexArray();
				const buffer = gl.createBuffer();
				if (!vao || !buffer) return false;
				this.cover = {
					program,
					vao,
					buffer,
					uView: gl.getUniformLocation(program, "uView"),
					uBias: gl.getUniformLocation(program, "uBias"),
				};
			} catch {
				return false;
			}
		}
		const c = this.cover;
		const first = faces.find((f) => f.quads.length > 0)?.quads[0];
		if (!first) return false;
		const origin = { x: first.at[0], y: first.at[1] };
		const vertices = coverVertices(faces, origin, { liftOf, eye: cameraEye(view) });
		gl.clearStencil(0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
		// biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook
		gl.useProgram(c.program);
		gl.bindVertexArray(c.vao);
		gl.bindBuffer(gl.ARRAY_BUFFER, c.buffer);
		gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
		const stride = COVER_VERTEX_FLOATS * 4;
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
		gl.enableVertexAttribArray(1);
		gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
		gl.uniformMatrix4fv(c.uView, false, viewMatrix(view, origin));
		gl.uniform1f(c.uBias, COVER_DEPTH_BIAS);
		gl.disable(gl.BLEND);
		gl.colorMask(false, false, false, false);
		gl.enable(gl.STENCIL_TEST);
		gl.stencilFunc(gl.ALWAYS, 1, 0xff);
		gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
		gl.depthFunc(gl.LESS);
		gl.drawArrays(gl.TRIANGLES, 0, vertices.length / COVER_VERTEX_FLOATS);
		gl.colorMask(true, true, true, true);
		gl.disable(gl.STENCIL_TEST);
		gl.depthFunc(gl.LEQUAL);
		gl.enable(gl.BLEND);
		return true;
	}

	/** A face's {@link coverLift}, remembered while the terrain stays the same. */
	private liftFor(
		sampler: unknown,
		groundAt: (x: number, y: number) => number,
		step: number,
	): (q: Quad3d) => number {
		if (!this.lifts || this.lifts.sampler !== sampler || this.lifts.values.size > 4096) {
			this.lifts = { sampler, values: new Map() };
		}
		const values = this.lifts.values;
		return (q) => {
			const key = `${q.at.join(",")}|${q.u.join(",")}|${q.v.join(",")}`;
			let lift = values.get(key);
			if (lift === undefined) {
				lift = coverLift(q, groundAt, step);
				values.set(key, lift);
			}
			return lift;
		};
	}

	/** The frame drawn so far onto the cover canvas (sized like ours). */
	private copyCover(target: HTMLCanvasElement): void {
		const source = this.gl.canvas as HTMLCanvasElement;
		if (target.width !== source.width) target.width = source.width;
		if (target.height !== source.height) target.height = source.height;
		const ctx = target.getContext("2d");
		if (!ctx) return;
		ctx.clearRect(0, 0, target.width, target.height);
		ctx.drawImage(source, 0, 0);
		this.covered = true;
	}

	/** Nothing covered: a clear cover canvas. */
	private clearCover(target: HTMLCanvasElement): void {
		if (!this.covered) return;
		this.covered = false;
		target.getContext("2d")?.clearRect(0, 0, target.width, target.height);
	}

	/**
	 * The decal texture for a tile, (re)painted when the decals there changed or the
	 * tile now shows at another resolution — within the frame's paint budget (`pending`
	 * when it had to wait: a stale texture is used meanwhile). `null` texture: no decals.
	 */
	private decalFor(
		decals: GroundDecalApi,
		key: string,
		tx: number,
		ty: number,
		worldSize: number,
		at: {
			vp: Viewport;
			camera: MeshCamera;
			width: number;
			height: number;
			dpr: number;
			/** The tile's mean height (world units), to judge its size on screen. */
			z: number;
			canPaint: (texels: number) => boolean;
			painted: (texels: number) => void;
		},
	): { texture: DecalTexture | null; pending: boolean } {
		const { gl } = this;
		const rect = tileWorldRect(tx, ty, worldSize);
		let tex = this.decalTextures.get(key) ?? null;
		// Ask with the widest margin a bitmap paints, so a decal just past the edge counts.
		if (decals.listFor("3d", decalLookupArea(rect)).length === 0) {
			if (tex) {
				gl.deleteTexture(tex.texture);
				this.decalTextures.delete(key);
			}
			return { texture: null, pending: false };
		}
		// Bitmap px for the tile's size in device px, held steady near a boundary.
		const screen =
			projectedTilePx(rect, at.z, at.vp, at.camera, { width: at.width, height: at.height }) *
			at.dpr;
		const px = nextDecalTilePx(screen, tex?.px ?? null);
		const stale =
			!tex || tex.px !== px || decals.changedSince(tex.version, "3d", decalTileArea(rect, tex.px));
		if (!stale) {
			if (tex) tex.used = this.frame;
			return { texture: tex, pending: false };
		}
		const cost = (px + 2 * DECAL_MARGIN) ** 2;
		if (!at.canPaint(cost)) {
			if (tex) tex.used = this.frame;
			return { texture: tex, pending: true };
		}
		at.painted(cost);
		const version = decals.version();
		const canvas = this.scratchCanvas(px + 2 * DECAL_MARGIN);
		const ctx = canvas?.getContext("2d");
		if (!canvas || !ctx) return { texture: tex, pending: false };
		paintDecalTile(ctx, decals, "3d", rect, px);
		const texture = tex?.texture ?? gl.createTexture();
		if (!texture) return { texture: null, pending: false };
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
		// Mipmaps: far ground shrinks the bitmap a lot (thin lines would shimmer).
		gl.generateMipmap(gl.TEXTURE_2D);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		tex = { texture, px, version, used: this.frame, bytes: decalBytes(px) };
		this.decalTextures.set(key, tex);
		return { texture: tex, pending: false };
	}

	/**
	 * Drop decal textures not drawn for a while, then the least recently drawn ones while
	 * all of them hold more than {@link DECAL_TEXTURE_BYTES} (never one drawn this frame).
	 */
	private dropDecalTextures(): void {
		const { gl } = this;
		let total = 0;
		for (const [key, tex] of this.decalTextures) {
			if (this.frame - tex.used > 120) {
				gl.deleteTexture(tex.texture);
				this.decalTextures.delete(key);
			} else {
				total += tex.bytes;
			}
		}
		if (total <= DECAL_TEXTURE_BYTES) return;
		const old = [...this.decalTextures]
			.filter(([, tex]) => tex.used < this.frame)
			.sort((a, b) => a[1].used - b[1].used);
		for (const [key, tex] of old) {
			if (total <= DECAL_TEXTURE_BYTES) break;
			gl.deleteTexture(tex.texture);
			this.decalTextures.delete(key);
			total -= tex.bytes;
		}
	}

	/** One reusable 2D canvas to paint decal bitmaps in, `size` px square. */
	private scratchCanvas(size: number): HTMLCanvasElement | null {
		if (typeof document === "undefined") return null;
		if (!this.scratch) this.scratch = document.createElement("canvas");
		if (this.scratch.width !== size) this.scratch.width = size;
		if (this.scratch.height !== size) this.scratch.height = size;
		return this.scratch;
	}

	dispose(): void {
		const { gl } = this;
		for (const tile of this.tiles.values()) gl.deleteBuffer(tile.buffer);
		this.tiles.clear();
		for (const tex of this.decalTextures.values()) gl.deleteTexture(tex.texture);
		this.decalTextures.clear();
		gl.deleteBuffer(this.indexBuffer);
		if (this.cover) {
			gl.deleteBuffer(this.cover.buffer);
			gl.deleteVertexArray(this.cover.vao);
			gl.deleteProgram(this.cover.program);
			this.cover = null;
		}
		gl.deleteTexture(this.ramp);
		gl.deleteVertexArray(this.vao);
		gl.deleteProgram(this.program);
	}
}

export function ElevationMeshLayer({
	store,
	display,
	overscan,
	view3d,
	state,
	decals,
	gpu,
	cover,
}: {
	store: BoardStore;
	display: ReactiveStore<ElevationDisplay>;
	overscan: ReactiveStore<{ px: number }>;
	view3d: () => View3dApi | undefined;
	state: ReactiveStore<MeshState>;
	/** Ground decals to paint onto the surface. */
	decals?: GroundDecalApi;
	/** The board's GPU drawing hook: while a GPU 3D renderer draws, it draws the mesh. */
	gpu?: View3dGlApi;
	/** Cover the shapes the hills hide (absent: the shapes stay in front). */
	cover?: MeshCover;
}) {
	const isOn = () =>
		(view3d()?.amount() ?? 0) > 0 && boardElevation(store) !== null && !gpu?.isDrawing();
	const [on, setOn] = useState(isOn);
	// biome-ignore lint/correctness/useExhaustiveDependencies: isOn reads only these
	useEffect(() => {
		// Only whether to draw at all re-renders here; the canvas redraws on its own.
		const check = () => setOn(isOn());
		check();
		const offs = [view3d()?.subscribe(check), store.subscribe(check), gpu?.subscribe(check)];
		return () => {
			for (const off of offs) off?.();
		};
	}, [store, view3d, gpu]);

	useEffect(() => {
		if (!on) state.set({ drawing: false });
	}, [on, state]);
	if (!on) return null;
	return (
		<MeshCanvas
			store={store}
			display={display}
			overscan={overscan}
			view3d={view3d}
			state={state}
			decals={decals}
			cover={cover}
		/>
	);
}

function MeshCanvas({
	store,
	display,
	overscan,
	view3d,
	state,
	decals,
	cover,
}: {
	store: BoardStore;
	display: ReactiveStore<ElevationDisplay>;
	overscan: ReactiveStore<{ px: number }>;
	view3d: () => View3dApi | undefined;
	state: ReactiveStore<MeshState>;
	decals?: GroundDecalApi;
	cover?: MeshCover;
}) {
	const ref = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		const canvas = ref.current;
		if (!canvas) return;
		const renderer = MeshRenderer.create(canvas);
		if (!renderer) {
			state.set({ drawing: false });
			return;
		}
		let raf = 0;
		let queued = false;
		let disposed = false;
		const draw = () => {
			if (disposed) return;
			queued = false;
			if (raf) cancelAnimationFrame(raf);
			raf = 0;
			const model = boardElevation(store);
			const v = view3d();
			if (!model || !v) return;
			const coverCanvas = cover?.target.get().canvas ?? null;
			const pending = renderer.draw({
				model,
				viewport: store.getViewport(),
				camera: v.camera(),
				width: canvas.clientWidth,
				height: canvas.clientHeight,
				dpr: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
				overscanPx: overscan.get().px,
				display: display.get(),
				store,
				decals,
				cover: cover && coverCanvas ? { canvas: coverCanvas, faces: cover.faces() } : undefined,
			});
			// Decal tiles left for the next frames (the paint budget ran out).
			if (pending && !raf) raf = requestAnimationFrame(draw);
		};
		// Redraw at the end of the task that changed something, so in the same frame: a
		// follow camera moves the viewport in its own animation frame, and a redraw one frame
		// later would put the hills (and the cover over the shapes) a frame behind the DOM
		// shapes on some frames and not others — they would judder against each other.
		const schedule = () => {
			if (queued) return;
			queued = true;
			queueMicrotask(draw);
		};
		const offs = [
			store.subscribe(schedule),
			display.subscribe(schedule),
			overscan.subscribe(schedule),
			view3d()?.subscribe(schedule),
			decals?.subscribe(schedule),
			cover?.target.subscribe(schedule),
		];
		const onResize = () => schedule();
		window.addEventListener("resize", onResize);
		draw();
		state.set({ drawing: true });
		return () => {
			for (const off of offs) off?.();
			window.removeEventListener("resize", onResize);
			disposed = true;
			if (raf) cancelAnimationFrame(raf);
			renderer.dispose();
			state.set({ drawing: false });
		};
	}, [store, display, overscan, view3d, state, decals, cover]);
	return (
		<canvas
			ref={ref}
			data-usketch-elevation-mesh=""
			style={{
				position: "absolute",
				inset: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
			}}
		/>
	);
}

/**
 * The cover canvas (see the file comment), over the shapes, while the mesh draws the
 * ground on its own canvas. The mesh paints it; this only mounts it.
 */
export function ElevationCoverLayer({
	target,
	state,
}: {
	target: ReactiveStore<CoverTarget>;
	state: ReactiveStore<MeshState>;
}) {
	const [drawing, setDrawing] = useState(() => state.get().drawing);
	useEffect(() => {
		const check = () => setDrawing(state.get().drawing);
		check();
		return state.subscribe(check);
	}, [state]);
	const ref = useCallback(
		(el: HTMLCanvasElement | null) => {
			// `set` skips `undefined` but not `null`: unmounting clears it.
			if (target.get().canvas !== el) target.set({ canvas: el });
		},
		[target],
	);
	if (!drawing) return null;
	return (
		<canvas
			ref={ref}
			data-usketch-elevation-cover=""
			style={{
				position: "absolute",
				inset: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
			}}
		/>
	);
}

/**
 * The mesh as a drawable of a GPU 3D renderer (`view3dGl` in shared): drawn into its
 * canvas and depth buffer, so what stands on the hills sorts against them. Asks for a
 * frame when the field, the look or the decals change while the renderer draws.
 * Returns its removal.
 */
export function registerElevationGlDrawable(opts: {
	gpu: View3dGlApi;
	store: BoardStore;
	display: ReactiveStore<ElevationDisplay>;
	overscan: ReactiveStore<{ px: number }>;
	state: ReactiveStore<MeshState>;
	decals?: GroundDecalApi;
}): () => void {
	const { gpu, store, display, overscan, state, decals } = opts;
	const renderers = new Map<WebGL2RenderingContext, MeshRenderer | null>();
	const drawable: View3dGlDrawable = {
		id: MESH_LAYER_ID,
		order: 0,
		draw(frame) {
			const model = boardElevation(store);
			if (!model) return false;
			let renderer = renderers.get(frame.gl);
			if (renderer === undefined) {
				renderer = MeshRenderer.fromGl(frame.gl);
				renderers.set(frame.gl, renderer);
			}
			if (!renderer) return false;
			const { viewport, camera, stage } = frame.view;
			const far = view3dOverscanPx(
				{
					camera: { pitch: camera.pitch, fov: camera.fov, horizon: camera.horizon, height: 0 },
					amount: frame.amount,
					drawDistance: frame.drawDistance,
				},
				viewport.zoom,
				stage.height,
			);
			return renderer.draw({
				model,
				viewport,
				camera,
				width: stage.width,
				height: stage.height,
				dpr: frame.pixelRatio,
				overscanPx: Math.max(overscan.get().px, far),
				display: display.get(),
				store,
				decals,
				external: true,
			});
		},
		release(gl) {
			renderers.get(gl)?.dispose();
			renderers.delete(gl);
		},
	};
	const unregister = gpu.register(drawable);
	let gpuDrawing = gpu.isDrawing();
	const redraw = (): void => {
		if (gpu.isDrawing()) gpu.requestFrame();
	};
	const offs = [
		store.subscribe(redraw),
		display.subscribe(redraw),
		overscan.subscribe(redraw),
		decals?.subscribe(redraw),
		// While the GPU renderer draws the mesh, the flat ground layer hides as with ours.
		gpu.subscribe(() => {
			const now = gpu.isDrawing();
			if (now === gpuDrawing) return;
			gpuDrawing = now;
			state.set({ drawing: now && boardElevation(store) !== null });
		}),
	];
	return () => {
		for (const off of offs) off?.();
		unregister();
	};
}
