// The board's shapes in the GPU 3D view: each shape's picture (see `shape-raster`) laid
// flat as a textured quad at the ground's height under its centre, in z-order. Like the
// CSS 3D renderer's flat shapes they are drawn over the ground and the terrain (not
// hidden by a hill: the terrain's drawn surface, water included, isn't known here).
// Pictures are made a few per frame (nearest the camera first) and kept until the shape
// changes; until then the shape shows as a pale placeholder.
import {
	type BoundingBox,
	type Point,
	type ShapeData,
	type ShapeRegistry,
	safeRotation,
	VIEW3D_DEPTH_GLSL,
	type View3dGlFrame,
	viewMatrix,
} from "@edv4h/usketch-shared";
import { linkProgram } from "./gpu3d-ground.js";
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
}

/** Time (ms) a frame may spend making pictures. */
const PICTURE_BUDGET_MS = 6;
/** Pictures being loaded at once, at most. */
const MAX_PENDING = 6;
/** Frames a picture is kept after its shape stops being drawn. */
const KEEP_FRAMES = 120;
const PLACEHOLDER: [number, number, number, number] = [0.55, 0.58, 0.65, 0.25];

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
uniform vec4 uRect;
uniform vec2 uRot;
uniform float uHeight;
out vec2 vUv;
${VIEW3D_DEPTH_GLSL}
void main() {
	vUv = aCorner;
	vec2 halfSize = uRect.zw * 0.5;
	vec2 p = aCorner * uRect.zw - halfSize;
	p = vec2(p.x * uRot.x - p.y * uRot.y, p.x * uRot.y + p.y * uRot.x);
	vec2 world = uRect.xy + halfSize + p;
	gl_Position = view3dPosition(uView * vec4(world, uHeight, 1.0));
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uHasTex;
uniform vec4 uColor;
out vec4 outColor;
void main() {
	vec4 c = uHasTex > 0.5 ? texture(uTex, vUv) : uColor;
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
		for (const name of ["uView", "uRect", "uRot", "uHeight", "uTex", "uHasTex", "uColor"]) {
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
		const { gl, u } = this;
		this.frameNo++;
		const { viewport } = frame.view;
		const drawn: { shape: ShapeData; picture: Picture | null; height: number }[] = [];
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
			const box = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
			drawn.push({ shape, picture, height: flatShapeHeight(box, source.groundAt) });
		}
		this.makePictures(due, source);
		this.forgetOld();

		if (drawn.length > 0) {
			const origin = gridOrigin(viewport.x, viewport.y, viewport.zoom);
			// biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook
			gl.useProgram(this.program);
			gl.bindVertexArray(this.vao);
			gl.uniformMatrix4fv(u.uView, false, viewMatrix(frame.view, origin));
			gl.uniform1i(u.uTex, 0);
			gl.uniform4fv(u.uColor, PLACEHOLDER);
			gl.activeTexture(gl.TEXTURE0);
			// Over the ground and the terrain, in z-order; leaves the depth to what stands.
			gl.depthFunc(gl.ALWAYS);
			gl.depthMask(false);
			for (const { shape, picture, height } of drawn) {
				const tex = picture && !picture.failed ? picture.texture : null;
				if (picture?.failed) continue;
				const rad = (safeRotation(shape.rotation) * Math.PI) / 180;
				gl.uniform4f(
					u.uRect,
					shape.x - PICTURE_PAD - origin.x,
					shape.y - PICTURE_PAD - origin.y,
					shape.width + 2 * PICTURE_PAD,
					shape.height + 2 * PICTURE_PAD,
				);
				gl.uniform2f(u.uRot, Math.cos(rad), Math.sin(rad));
				gl.uniform1f(u.uHeight, height);
				gl.uniform1f(u.uHasTex, tex ? 1 : 0);
				gl.bindTexture(gl.TEXTURE_2D, tex);
				gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
			}
			gl.depthFunc(gl.LEQUAL);
			gl.depthMask(true);
			gl.bindTexture(gl.TEXTURE_2D, null);
			gl.bindVertexArray(null);
		}
		return due.length > 0 && this.pending < MAX_PENDING;
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

/** A grid-aligned world point near the view's top-left (keeps float32 vertices small). */
function gridOrigin(vx: number, vy: number, zoom: number): Point {
	const z = zoom > 0 ? zoom : 1;
	return { x: Math.round(-vx / z / 256) * 256, y: Math.round(-vy / z / 256) * 256 };
}

function now(): number {
	return typeof performance !== "undefined" ? performance.now() : Date.now();
}
