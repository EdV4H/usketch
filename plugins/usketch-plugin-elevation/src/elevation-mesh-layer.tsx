// The elevation as a surface in a 3D view (Mode 7): one WebGL2 canvas over the stage,
// NOT tilted by Mode 7 — it projects its vertices itself with the same transform Mode 7
// gives its tilted layers (see `projectLifted`), so the hills sit exactly where the
// board, the characters and the map are drawn. Only while the view is (partly) 3D;
// meanwhile the flat ground layer is hidden. Without WebGL2 nothing is drawn here and
// the flat layer stays (its shading tilted with the board, as before).
//
// The canvas is one layer: DOM layers above it (shapes, characters) are always drawn
// in front of the hills, even behind one.
import {
	type BoardStore,
	type View3dApi,
	type Viewport,
	viewportRotation,
	worldToScreen,
} from "@edv4h/usketch-shared";
import { useEffect, useRef, useState } from "react";
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

/** Depth range in px: depth values are scaled by 1 / this into the depth buffer. */
const DEPTH_RANGE = 200_000;

const VERTEX = `#version 300 es
in vec4 aVertex; // local x, local y, height, shade
uniform vec2 uOrigin;  // the tile's corner on the flat stage (px)
uniform vec2 uAxis;    // zoom·(cos, sin) of the board's rotation
uniform float uZoom;
uniform vec2 uPivot;   // the tilt's origin (px)
uniform vec4 uCam;     // cos yaw, sin yaw, cos pitch, sin pitch
uniform float uFov;
uniform float uCameraHeight; // px the camera is raised (everything drawn this much lower)
uniform vec2 uSize;    // stage px
uniform float uWater;  // < 0: none
out float vHeight;
out float vShade;
void main() {
	vec2 s = uOrigin + vec2(aVertex.x * uAxis.x - aVertex.y * uAxis.y, aVertex.x * uAxis.y + aVertex.y * uAxis.x);
	float h = uWater >= 0.0 ? max(aVertex.z, uWater) : aVertex.z;
	float z = h * uZoom - uCameraHeight;
	float x0 = s.x - uPivot.x;
	float y0 = s.y - uPivot.y;
	float x1 = x0 * uCam.x - y0 * uCam.y;
	float y1 = x0 * uCam.y + y0 * uCam.x;
	float y2 = y1 * uCam.z - z * uCam.w;
	float z2 = y1 * uCam.w + z * uCam.z;
	float w = 1.0 - z2 / uFov;
	// Screen = pivot + (x1, y2) / w, left to the GPU's divide by w (so colours and
	// heights are interpolated in perspective).
	gl_Position = vec4(
		(uPivot.x * w + x1) * 2.0 / uSize.x - w,
		w - (uPivot.y * w + y2) * 2.0 / uSize.y,
		clamp(-z2 / ${DEPTH_RANGE.toFixed(1)}, -1.0, 1.0) * w,
		w
	);
	vHeight = aVertex.z;
	vShade = aVertex.w;
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in float vHeight;
in float vShade;
uniform sampler2D uRamp;
uniform float uRange;
uniform float uWater;
uniform float uContour;
uniform float uTint;
uniform float uShadeOn;
uniform float uFadeZero;
out vec4 outColor;
void main() {
	vec3 c = uTint > 0.5 ? texture(uRamp, vec2(clamp(vHeight / uRange, 0.0, 1.0), 0.5)).rgb : vec3(0.86);
	bool under = uWater >= 0.0 && vHeight < uWater;
	if (uShadeOn > 0.5 && !under) c *= vShade;
	if (uContour > 0.0 && !under && vHeight > 0.0) {
		float t = vHeight / uContour;
		float d = abs(fract(t - 0.5) - 0.5) / max(fwidth(t), 1e-5);
		c *= mix(0.62, 1.0, clamp(d - 0.5, 0.0, 1.0));
	}
	// A field without generated terrain: flat ground (0) is see-through, as in 2D.
	float a = uFadeZero > 0.5 ? clamp(vHeight / 6.0, 0.0, 1.0) : 1.0;
	outColor = vec4(c * a, a);
}`;

interface TileMesh {
	revision: string;
	buffer: WebGLBuffer;
	used: number;
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
	private frame = 0;
	private readonly u: Record<string, WebGLUniformLocation | null> = {};

	static create(canvas: HTMLCanvasElement): MeshRenderer | null {
		const gl = canvas.getContext("webgl2", { antialias: true, premultipliedAlpha: true });
		if (!gl) return null;
		try {
			return new MeshRenderer(gl);
		} catch {
			return null;
		}
	}

	private constructor(gl: WebGL2RenderingContext) {
		this.gl = gl;
		const shader = (type: number, src: string) => {
			const s = gl.createShader(type);
			if (!s) throw new Error("shader");
			gl.shaderSource(s, src);
			gl.compileShader(s);
			if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
				throw new Error(gl.getShaderInfoLog(s) ?? "");
			return s;
		};
		const program = gl.createProgram();
		if (!program) throw new Error("program");
		gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
		gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
		gl.bindAttribLocation(program, 0, "aVertex");
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			throw new Error(gl.getProgramInfoLog(program) ?? "");
		}
		this.program = program;
		for (const name of [
			"uOrigin",
			"uAxis",
			"uZoom",
			"uPivot",
			"uCam",
			"uFov",
			"uCameraHeight",
			"uSize",
			"uWater",
			"uRamp",
			"uRange",
			"uContour",
			"uTint",
			"uShadeOn",
			"uFadeZero",
		]) {
			this.u[name] = gl.getUniformLocation(program, name);
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
	}): void {
		const { gl, u } = this;
		const { model, viewport: vp, camera, width, height, display } = opts;
		const field = model.field;
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
		const rect = visibleWorldRect(opts.store, opts.overscanPx);
		const plan = rect ? planTiles(field, rect, vp.zoom) : null;
		if (!plan) return;

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

		const r = Math.PI / 180;
		const rot = viewportRotation(vp) * r;
		gl.uniform2f(u.uAxis, vp.zoom * Math.cos(rot), vp.zoom * Math.sin(rot));
		gl.uniform1f(u.uZoom, vp.zoom);
		gl.uniform2f(u.uPivot, width / 2, height * camera.horizon);
		gl.uniform4f(
			u.uCam,
			Math.cos(camera.yaw * r),
			Math.sin(camera.yaw * r),
			Math.cos(camera.pitch * r),
			Math.sin(camera.pitch * r),
		);
		gl.uniform1f(u.uFov, camera.fov);
		gl.uniform1f(u.uCameraHeight, camera.heightPx ?? 0);
		gl.uniform2f(u.uSize, width, height);
		gl.uniform1f(u.uWater, field.waterLevel ?? -1);
		gl.uniform1i(u.uRamp, 0);
		gl.uniform1f(u.uRange, range);
		gl.uniform1f(u.uContour, display.contour);
		gl.uniform1f(u.uTint, display.tint ? 1 : 0);
		gl.uniform1f(u.uShadeOn, display.shade ? 1 : 0);
		gl.uniform1f(u.uFadeZero, field.seed === null && field.waterLevel === null ? 1 : 0);

		const sampler = elevationSampler(model);
		const fk = `${field.id}|${field.spacing}|${n}|${field.seed}|${field.waterLevel}|${field.gen.relief}|${field.gen.scale}|${field.gen.roughness}|${field.gen.ridges}|${field.gen.octaves}`;
		const count = n * n * 6;
		for (let ty = plan.ty0; ty <= plan.ty1; ty++) {
			for (let tx = plan.tx0; tx <= plan.tx1; tx++) {
				const key = `${plan.level}:${chunkKey(tx, ty)}`;
				const revision = `${fk}#${tileRevision(model, plan.level, tx, ty)}`;
				let tile = this.tiles.get(key);
				if (!tile || tile.revision !== revision) {
					const buffer = tile?.buffer ?? gl.createBuffer();
					if (!buffer) continue;
					gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
					gl.bufferData(
						gl.ARRAY_BUFFER,
						buildTileMesh(sampler, plan.level, tx, ty),
						gl.STATIC_DRAW,
					);
					tile = { revision, buffer, used: this.frame };
					this.tiles.set(key, tile);
				}
				tile.used = this.frame;
				gl.bindBuffer(gl.ARRAY_BUFFER, tile.buffer);
				gl.enableVertexAttribArray(0);
				gl.vertexAttribPointer(0, VERTEX_FLOATS, gl.FLOAT, false, VERTEX_FLOATS * 4, 0);
				const o = worldToScreen(tx * plan.worldSize, ty * plan.worldSize, vp);
				gl.uniform2f(u.uOrigin, o.x, o.y);
				gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
			}
		}
		// Drop the meshes of tiles no longer drawn (a few frames' grace for panning back).
		for (const [key, tile] of this.tiles) {
			if (this.frame - tile.used > 120) {
				gl.deleteBuffer(tile.buffer);
				this.tiles.delete(key);
			}
		}
	}

	dispose(): void {
		const { gl } = this;
		for (const tile of this.tiles.values()) gl.deleteBuffer(tile.buffer);
		this.tiles.clear();
		gl.deleteBuffer(this.indexBuffer);
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
}: {
	store: BoardStore;
	display: ReactiveStore<ElevationDisplay>;
	overscan: ReactiveStore<{ px: number }>;
	view3d: () => View3dApi | undefined;
	state: ReactiveStore<MeshState>;
}) {
	const isOn = () => (view3d()?.amount() ?? 0) > 0 && boardElevation(store) !== null;
	const [on, setOn] = useState(isOn);
	// biome-ignore lint/correctness/useExhaustiveDependencies: isOn reads only these
	useEffect(() => {
		// Only whether to draw at all re-renders here; the canvas redraws on its own.
		const check = () => setOn(isOn());
		check();
		const offs = [view3d()?.subscribe(check), store.subscribe(check)];
		return () => {
			for (const off of offs) off?.();
		};
	}, [store, view3d]);

	useEffect(() => {
		if (!on) state.set({ drawing: false });
	}, [on, state]);
	if (!on) return null;
	return (
		<MeshCanvas store={store} display={display} overscan={overscan} view3d={view3d} state={state} />
	);
}

function MeshCanvas({
	store,
	display,
	overscan,
	view3d,
	state,
}: {
	store: BoardStore;
	display: ReactiveStore<ElevationDisplay>;
	overscan: ReactiveStore<{ px: number }>;
	view3d: () => View3dApi | undefined;
	state: ReactiveStore<MeshState>;
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
		const draw = () => {
			raf = 0;
			const model = boardElevation(store);
			const v = view3d();
			if (!model || !v) return;
			renderer.draw({
				model,
				viewport: store.getViewport(),
				camera: v.camera(),
				width: canvas.clientWidth,
				height: canvas.clientHeight,
				dpr: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
				overscanPx: overscan.get().px,
				display: display.get(),
				store,
			});
		};
		const schedule = () => {
			if (!raf) raf = requestAnimationFrame(draw);
		};
		const offs = [
			store.subscribe(schedule),
			display.subscribe(schedule),
			overscan.subscribe(schedule),
			view3d()?.subscribe(schedule),
		];
		const onResize = () => schedule();
		window.addEventListener("resize", onResize);
		draw();
		state.set({ drawing: true });
		return () => {
			for (const off of offs) off?.();
			window.removeEventListener("resize", onResize);
			if (raf) cancelAnimationFrame(raf);
			renderer.dispose();
			state.set({ drawing: false });
		};
	}, [store, display, overscan, view3d, state]);
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
