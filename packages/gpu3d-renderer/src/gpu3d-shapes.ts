// The board's shapes in the GPU 3D view, from each shape's picture (see `shape-raster`).
//
// - A shape without 3D lies flat as a textured quad at the ground's height under its
//   centre, in z-order. Like the CSS 3D renderer's flat shapes it is drawn over the ground
//   and the terrain (not hidden by a hill: the terrain's drawn surface, water included,
//   isn't known here).
// - A 3D shape (`stand` / `box` / `float`, chosen as the CSS 3D renderer chooses them,
//   `selectView3dShapes`) is placed as the CSS 3D renderer places it — stood up about its
//   foot, a top with four walls, or lifted flat — but with depth: the terrain and the
//   other 3D shapes hide it, and it hides them.
//
// Pictures are made a few per frame (nearest the camera first) and kept until the shape
// changes; until then the shape shows as a pale placeholder.
import {
	type BoundingBox,
	type Point,
	type ShapeData,
	type ShapeRegistry,
	type ShapeView3d,
	safeRotation,
	shapeView3dAnchor,
	VIEW3D_DEPTH_GLSL,
	type View3dGlFrame,
	view3dShapeHeading,
	view3dShapeWallColor,
	viewMatrix,
	viewportRotation,
} from "@edv4h/usketch-shared";
import { linkProgram, parseCssColor } from "./gpu3d-ground.js";
import {
	loadSvgImage,
	nodePictureSvg,
	PICTURE_PAD,
	pictureScale,
	primitivePicture,
} from "./shape-raster.js";

/** What the shapes are drawn from in a frame (the latest layer render context). */
export interface ShapeSource {
	shapes: readonly ShapeData[];
	registry: ShapeRegistry;
	/** The DOM node a shape is drawn in (hidden while the GPU draws), or `null`. */
	node(id: string): Element | null;
	/** The ground's height under a world point. */
	groundAt(x: number, y: number): number;
	/** The shapes drawn in 3D now, with their parameters (none: all lie flat). */
	view3d?: ReadonlyMap<string, ShapeView3d>;
	/** The camera's full yaw (deg), for stood-up shapes facing it. */
	yaw?: number;
}

/** Time (ms) a frame may spend making pictures. */
const PICTURE_BUDGET_MS = 6;
/** Pictures being loaded at once, at most. */
const MAX_PENDING = 6;
/** Frames a picture is kept after its shape stops being drawn. */
const KEEP_FRAMES = 120;
const PLACEHOLDER: [number, number, number, number] = [0.55, 0.58, 0.65, 0.25];
const WALL_FALLBACK: [number, number, number, number] = [0x9e / 255, 0x9e / 255, 0x9e / 255, 1];

type Vec3 = [number, number, number];

/** A quad in world space (height up): its top-left corner and its two edges. */
export interface Quad3d {
	at: Vec3;
	/** Along the picture's width (uv x 0 → 1). */
	u: Vec3;
	/** Along the picture's height, downward in it (uv y 0 → 1). */
	v: Vec3;
}

/** How a 3D shape is drawn this frame: the picture quad, walls and shadow. */
export interface Shape3dGeometry {
	/** The shape's picture (padded by `pad` world units). */
	picture: Quad3d;
	/** A box's walls (no padding), with how much they darken. */
	walls: { quad: Quad3d; shade: number }[];
	/** The soft shadow on the ground (a quad the shadow ellipse fills), and its strength. */
	shadow: { quad: Quad3d; opacity: number } | null;
	/** Lies flat on its ground (no depth): drawn with the flat shapes, in z-order. */
	flat: boolean;
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];

function flatQuad(cx: number, cy: number, z: number, w: number, h: number, rad: number): Quad3d {
	const dx: Vec3 = [Math.cos(rad), Math.sin(rad), 0];
	const dy: Vec3 = [-Math.sin(rad), Math.cos(rad), 0];
	return {
		at: add(add([cx, cy, z], mul(dx, -w / 2)), mul(dy, -h / 2)),
		u: mul(dx, w),
		v: mul(dy, h),
	};
}

/**
 * Where a 3D shape's parts are (world units, height up), as the CSS 3D renderer places
 * them (`shapePose`): a `stand` shape folded up about its foot by `90° × amount`, turned
 * to its heading; a `box` top and walls risen to `height × amount`; a `float` face lifted
 * to it. `pad` grows the picture quad (the picture's margin). Pure.
 */
export function shape3dGeometry(
	shape: ShapeData,
	params: ShapeView3d,
	view: {
		amount: number;
		yaw: number;
		viewportRotation: number;
		groundHeight: number;
		pad: number;
	},
): Shape3dGeometry {
	const amount = Math.min(1, Math.max(0, Number.isFinite(view.amount) ? view.amount : 0));
	const ground = params.ground ? Math.max(0, view.groundHeight) : 0;
	const rot = safeRotation(shape.rotation);
	const { width: w, height: h } = shape;
	const pad = view.pad;
	const anchor = shapeView3dAnchor(shape, params.mode);
	if (params.mode === "stand") {
		// The heading on the flat screen, back to the world (the view turns it by its rotation).
		const screen = view3dShapeHeading(params, rot + view.viewportRotation, amount, view.yaw);
		const rad = ((screen - view.viewportRotation) * Math.PI) / 180;
		const dx: Vec3 = [Math.cos(rad), Math.sin(rad), 0];
		const fold = (amount * Math.PI) / 2;
		// The picture's "up" (toward its top), folding from the flat board up to the sky.
		const up: Vec3 = [
			Math.sin(rad) * Math.cos(fold),
			-Math.cos(rad) * Math.cos(fold),
			Math.sin(fold),
		];
		const foot: Vec3 = [anchor.x, anchor.y, ground];
		const shadowW = Math.max(4, w * 0.9);
		const shadowD = Math.max(2, Math.min(w, h) * 0.3);
		return {
			picture: {
				at: add(add(foot, mul(dx, -w / 2 - pad)), mul(up, h + pad)),
				u: mul(dx, w + 2 * pad),
				v: mul(up, -(h + 2 * pad)),
			},
			walls: [],
			shadow:
				params.shadow && amount > 0
					? { quad: flatQuad(anchor.x, anchor.y, ground, shadowW, shadowD, rad), opacity: amount }
					: null,
			flat: false,
		};
	}
	const rad = (rot * Math.PI) / 180;
	const rise = Math.max(0, params.height) * amount;
	const top = ground + rise;
	const picture = flatQuad(anchor.x, anchor.y, top, w + 2 * pad, h + 2 * pad, rad);
	if (params.mode === "box") {
		const body = flatQuad(anchor.x, anchor.y, top, w, h, rad);
		const tl = body.at;
		const tr = add(tl, body.u);
		const bl = add(tl, body.v);
		const br = add(tr, body.v);
		const down: Vec3 = [0, 0, -rise];
		const wall = (a: Vec3, b: Vec3, shade: number) => ({
			quad: { at: a, u: [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as Vec3, v: down },
			shade,
		});
		return {
			picture,
			walls:
				rise > 0
					? [wall(tl, tr, 0.22), wall(tr, br, 0.35), wall(br, bl, 0.22), wall(bl, tl, 0.35)]
					: [],
			shadow: null,
			flat: !(rise > 0),
		};
	}
	return {
		picture,
		walls: [],
		shadow:
			params.shadow && amount > 0 && rise > 0
				? {
						quad: flatQuad(
							anchor.x,
							anchor.y,
							ground,
							Math.max(4, w * 0.9),
							Math.max(2, h * 0.9),
							rad,
						),
						opacity: amount * 0.7,
					}
				: null,
		flat: !(rise > 0),
	};
}

/** How high a flat shape lies: the ground under its centre (as the CSS 3D renderer). Pure. */
export function flatShapeHeight(
	box: BoundingBox,
	groundAt: (x: number, y: number) => number,
): number {
	const h = groundAt(box.x + box.width / 2, box.y + box.height / 2);
	return Number.isFinite(h) && h > 0 ? h : 0;
}

/**
 * The key a shape's picture is made for: the shape object (the store replaces it on any
 * change) and the picture scale.
 */
interface Picture {
	shape: ShapeData;
	scale: number;
	texture: WebGLTexture | null;
	/** Loading (an image is on its way). */
	pending: boolean;
	failed: boolean;
	lastFrame: number;
}

const VERTEX = `#version 300 es
layout(location = 0) in vec2 aCorner;
uniform mat4 uView;
uniform vec3 uAt;
uniform vec3 uU;
uniform vec3 uV;
out vec2 vUv;
${VIEW3D_DEPTH_GLSL}
void main() {
	vUv = aCorner;
	vec3 world = uAt + aCorner.x * uU + aCorner.y * uV;
	gl_Position = view3dPosition(uView * vec4(world, 1.0));
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
// 0: the picture, 1: a flat colour, 2: a soft shadow ellipse.
uniform float uKind;
uniform vec4 uColor;
out vec4 outColor;
void main() {
	vec4 c;
	if (uKind < 0.5) {
		c = texture(uTex, vUv);
	} else if (uKind < 1.5) {
		c = uColor;
	} else {
		float r = length(vUv - 0.5) * 2.0;
		c = vec4(0.0, 0.0, 0.0, 0.3 * uColor.a * (1.0 - smoothstep(0.0, 1.0, r)));
	}
	if (c.a < 0.004) discard;
	outColor = c;
}`;

export class ShapePainter {
	private readonly program: WebGLProgram;
	private readonly vao: WebGLVertexArrayObject;
	private readonly buffer: WebGLBuffer;
	private readonly u: Record<string, WebGLUniformLocation | null> = {};
	private readonly pictures = new Map<string, Picture>();
	private frameNo = 0;
	/** Anisotropic filtering (sharp pictures seen at a grazing angle), when there is. */
	private readonly aniso: { ext: number; max: number } | null;
	private pending = 0;
	private released = false;

	constructor(
		private readonly gl: WebGL2RenderingContext,
		/** Asked for another frame when a picture is ready. */
		private readonly onReady: () => void,
	) {
		this.program = linkProgram(gl, VERTEX, FRAGMENT);
		const ext = gl.getExtension("EXT_texture_filter_anisotropic");
		this.aniso = ext
			? {
					ext: ext.TEXTURE_MAX_ANISOTROPY_EXT,
					max: Math.min(8, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number),
				}
			: null;
		for (const name of ["uView", "uAt", "uU", "uV", "uTex", "uKind", "uColor"]) {
			this.u[name] = gl.getUniformLocation(this.program, name);
		}
		const vao = gl.createVertexArray();
		const buffer = gl.createBuffer();
		if (!vao || !buffer) throw new Error("gl objects");
		this.vao = vao;
		this.buffer = buffer;
		gl.bindVertexArray(vao);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
		gl.bindVertexArray(null);
	}

	/** Draw the shapes; `true` when pictures are still to be made (draw again). */
	draw(frame: View3dGlFrame, source: ShapeSource): boolean {
		this.frameNo++;
		const { viewport } = frame.view;
		const view = {
			amount: frame.amount,
			yaw: source.yaw ?? 0,
			viewportRotation: viewportRotation(viewport),
			pad: PICTURE_PAD,
			groundHeight: 0,
		};
		const flat: { picture: Picture | null; quad: Quad3d }[] = [];
		const shadows: { quad: Quad3d; opacity: number }[] = [];
		const solid: { picture: Picture | null; geo: Shape3dGeometry; wall: Color }[] = [];
		const due: { shape: ShapeData; scale: number; nearness: number }[] = [];
		for (const shape of source.shapes) {
			if (shape.hidden) continue;
			if (!(shape.width > 0 && shape.height > 0)) continue;
			const def = source.registry.get(shape.type);
			if (!def) continue;
			const node = source.node(shape.id);
			if (!node && !def.gpuPrimitive) continue;
			const scale = pictureScale(viewport.zoom, frame.pixelRatio, shape.width, shape.height);
			const picture = this.pictures.get(shape.id) ?? null;
			if (picture) picture.lastFrame = this.frameNo;
			const fresh = picture && picture.shape === shape && picture.scale === scale;
			if (!fresh && !picture?.pending) {
				// Nearer the camera = lower on the flat screen.
				const nearness = (shape.y + shape.height / 2) * viewport.zoom + viewport.y;
				due.push({ shape, scale, nearness });
			}
			if (picture?.failed) continue;
			const params = source.view3d?.get(shape.id);
			if (params) {
				const at = shapeView3dAnchor(shape, params.mode);
				view.groundHeight = params.ground ? source.groundAt(at.x, at.y) : 0;
				const geo = shape3dGeometry(shape, params, view);
				if (geo.shadow) shadows.push(geo.shadow);
				if (geo.flat) flat.push({ picture, quad: geo.picture });
				else solid.push({ picture, geo, wall: wallColor(shape) });
				continue;
			}
			const box = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
			flat.push({
				picture,
				quad: flatQuad(
					shape.x + shape.width / 2,
					shape.y + shape.height / 2,
					flatShapeHeight(box, source.groundAt),
					shape.width + 2 * PICTURE_PAD,
					shape.height + 2 * PICTURE_PAD,
					(safeRotation(shape.rotation) * Math.PI) / 180,
				),
			});
		}
		this.makePictures(due, source);
		this.forgetOld();

		if (flat.length + shadows.length + solid.length > 0) {
			const { gl, u } = this;
			const origin = gridOrigin(viewport.x, viewport.y, viewport.zoom);
			// biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook
			gl.useProgram(this.program);
			gl.bindVertexArray(this.vao);
			gl.uniformMatrix4fv(u.uView, false, viewMatrix(frame.view, origin));
			gl.uniform1i(u.uTex, 0);
			gl.activeTexture(gl.TEXTURE0);
			// Flat shapes and shadows: over the ground and the terrain, in z-order, leaving the
			// depth to what stands.
			gl.depthFunc(gl.ALWAYS);
			gl.depthMask(false);
			for (const { picture, quad } of flat) this.drawPicture(picture, quad, origin);
			for (const { quad, opacity } of shadows) {
				this.quad(quad, origin, 2, [0, 0, 0, opacity]);
			}
			// What stands: with depth.
			gl.depthFunc(gl.LEQUAL);
			gl.depthMask(true);
			for (const { picture, geo, wall } of solid) {
				for (const w of geo.walls) {
					const k = 1 - w.shade;
					this.quad(w.quad, origin, 1, [wall[0] * k, wall[1] * k, wall[2] * k, wall[3]]);
				}
				this.drawPicture(picture, geo.picture, origin);
			}
			gl.bindTexture(gl.TEXTURE_2D, null);
			gl.bindVertexArray(null);
		}
		return due.length > 0 && this.pending < MAX_PENDING;
	}

	private drawPicture(picture: Picture | null, quad: Quad3d, origin: Point): void {
		const tex = picture?.texture ?? null;
		this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
		this.quad(quad, origin, tex ? 0 : 1, PLACEHOLDER);
	}

	private quad(q: Quad3d, origin: Point, kind: number, color: Color): void {
		const { gl, u } = this;
		gl.uniform3f(u.uAt, q.at[0] - origin.x, q.at[1] - origin.y, q.at[2]);
		gl.uniform3f(u.uU, q.u[0], q.u[1], q.u[2]);
		gl.uniform3f(u.uV, q.v[0], q.v[1], q.v[2]);
		gl.uniform1f(u.uKind, kind);
		gl.uniform4fv(u.uColor, color);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}

	private makePictures(
		due: { shape: ShapeData; scale: number; nearness: number }[],
		source: ShapeSource,
	): void {
		if (due.length === 0) return;
		due.sort((a, b) => b.nearness - a.nearness);
		const start = now();
		for (const { shape, scale } of due) {
			if (this.pending >= MAX_PENDING || now() - start > PICTURE_BUDGET_MS) break;
			const def = source.registry.get(shape.type);
			if (!def) continue;
			const old = this.pictures.get(shape.id);
			const picture: Picture = {
				shape,
				scale,
				// Keep showing the old picture until the new one is ready.
				texture: old?.texture ?? null,
				pending: false,
				failed: false,
				lastFrame: this.frameNo,
			};
			this.pictures.set(shape.id, picture);
			const node = source.node(shape.id);
			try {
				if (node) {
					const svg = nodePictureSvg(node, shape.width, shape.height, scale);
					picture.pending = true;
					this.pending++;
					loadSvgImage(svg).then(
						(img) => this.finish(shape.id, picture, img),
						() => this.finish(shape.id, picture, null),
					);
				} else {
					const prim = def.gpuPrimitive?.(shape) ?? null;
					const canvas = prim ? primitivePicture(shape, prim, scale) : null;
					this.upload(picture, canvas);
				}
			} catch {
				picture.failed = !picture.texture;
			}
		}
	}

	private finish(id: string, picture: Picture, img: HTMLImageElement | null): void {
		this.pending--;
		picture.pending = false;
		if (this.released || this.pictures.get(id) !== picture) return;
		this.upload(picture, img);
		this.onReady();
	}

	private upload(picture: Picture, src: TexImageSource | null): void {
		const { gl } = this;
		if (!src) {
			picture.failed = !picture.texture;
			return;
		}
		const tex = picture.texture ?? gl.createTexture();
		if (!tex) return;
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
		try {
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
			gl.generateMipmap(gl.TEXTURE_2D);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			if (this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso.ext, this.aniso.max);
			picture.texture = tex;
			picture.failed = false;
		} catch {
			// A tainted picture (a browser that won't let it on the GPU): the placeholder stays.
			if (!picture.texture) gl.deleteTexture(tex);
			picture.failed = !picture.texture;
		} finally {
			gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
			gl.bindTexture(gl.TEXTURE_2D, null);
		}
	}

	private forgetOld(): void {
		for (const [id, p] of this.pictures) {
			if (this.frameNo - p.lastFrame > KEEP_FRAMES && !p.pending) {
				if (p.texture) this.gl.deleteTexture(p.texture);
				this.pictures.delete(id);
			}
		}
	}

	/** Pictures held now (tests, stats). */
	pictureCount(): number {
		return this.pictures.size;
	}

	release(): void {
		this.released = true;
		const { gl } = this;
		for (const p of this.pictures.values()) if (p.texture) gl.deleteTexture(p.texture);
		this.pictures.clear();
		gl.deleteBuffer(this.buffer);
		gl.deleteVertexArray(this.vao);
		gl.deleteProgram(this.program);
	}
}

type Color = [number, number, number, number];

/** A box's wall colour, premultiplied (grey when it can't be read). */
function wallColor(shape: ShapeData): Color {
	const parsed = parseCssColor(view3dShapeWallColor(shape));
	return parsed && parsed[3] > 0 ? parsed : WALL_FALLBACK;
}

/** A grid-aligned world point near the view's top-left (keeps float32 vertices small). */
function gridOrigin(vx: number, vy: number, zoom: number): Point {
	const z = zoom > 0 ? zoom : 1;
	return { x: Math.round(-vx / z / 256) * 256, y: Math.round(-vy / z / 256) * 256 };
}

function now(): number {
	return typeof performance !== "undefined" ? performance.now() : Date.now();
}
