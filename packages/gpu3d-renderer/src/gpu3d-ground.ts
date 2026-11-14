// The ground of the GPU 3D view: the board's background (and its grid, when the board
// shows one) on the plane at height 0, as far as the draw distance shows it. It is drawn
// first and without writing depth, as a backdrop: the terrain and what stands on the
// ground draw over it.
import {
	type Point,
	screenToWorld,
	VIEW3D_DEPTH_GLSL,
	type View3dGlFrame,
	type Viewport,
	viewMatrix,
} from "@edv4h/usketch-shared";

/** World units between grid lines (the bg-grid plugin's). */
export const GROUND_GRID_SIZE = 20;

/** A rectangle of the flat stage, px. */
export interface StageRect {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

/**
 * The part of the flat stage (px, before the tilt) the ground covers: the stage box, cut
 * to the near band or grown past the box by the draw distance — as the CSS 3D renderer
 * clips its tilted layers (`drawDistanceClip`). Pure.
 */
export function groundRegionPx(
	drawDistance: number,
	zoom: number,
	width: number,
	height: number,
	amount = 1,
): StageRect {
	const box = { left: 0, top: 0, right: width, bottom: height };
	if (!(drawDistance > 0) || !(zoom > 0) || !(height > 0)) return box;
	const band = drawDistance * zoom;
	if (band <= height) {
		const s = Math.min(1, Math.max(0, amount));
		return { ...box, top: (height - band) * s };
	}
	const over = band - height;
	return { left: -over, top: -over, right: width + over, bottom: height + over };
}

/** The world corners of a flat-stage rectangle (clockwise from top-left). Pure. */
export function stageRectWorld(r: StageRect, viewport: Viewport): Point[] {
	return [
		screenToWorld(r.left, r.top, viewport),
		screenToWorld(r.right, r.top, viewport),
		screenToWorld(r.right, r.bottom, viewport),
		screenToWorld(r.left, r.bottom, viewport),
	];
}

/** A CSS colour as premultiplied RGBA 0…1 (`null` when it can't be read). Pure. */
export function parseCssColor(css: string): [number, number, number, number] | null {
	const m = css.trim().match(/^rgba?\(([^)]+)\)$/i);
	if (m) {
		const parts = m[1]
			.split(/[\s,/]+/)
			.filter(Boolean)
			.map(Number);
		if (parts.length < 3 || parts.slice(0, 3).some((n) => !Number.isFinite(n))) return null;
		const a = parts.length > 3 && Number.isFinite(parts[3]) ? parts[3] : 1;
		return [(parts[0] / 255) * a, (parts[1] / 255) * a, (parts[2] / 255) * a, a];
	}
	const hex = css.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (hex) {
		const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
		const n = Number.parseInt(h, 16);
		return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
	}
	return null;
}

const VERTEX = `#version 300 es
layout(location = 0) in vec2 aWorld;
uniform mat4 uView;
out vec2 vWorld;
${VIEW3D_DEPTH_GLSL}
void main() {
	vWorld = aWorld;
	gl_Position = view3dPosition(uView * vec4(aWorld, 0.0, 1.0));
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vWorld;
uniform vec4 uBackground;
uniform vec4 uLine;
uniform float uGrid;
uniform float uGridSize;
uniform float uLineWidth;
out vec4 outColor;
void main() {
	vec4 color = uBackground;
	if (uGrid > 0.5) {
		vec2 c = vWorld / uGridSize;
		vec2 fw = max(fwidth(c), vec2(1e-6));
		// Distance to the nearest line and the line's half width, in cells.
		vec2 d = abs(fract(c - 0.5) - 0.5);
		float hw = 0.5 * uLineWidth / uGridSize;
		// At least a device px wide; thinner lines get fainter instead.
		vec2 w = max(vec2(2.0 * hw), fw);
		vec2 cover = clamp((0.5 * w + 0.5 * fw - d) / fw, 0.0, 1.0) * (2.0 * hw / w);
		float on = 1.0 - (1.0 - cover.x) * (1.0 - cover.y);
		// Where cells get a few px small, fade to the lines' average cover (no moire).
		float cellPx = 1.0 / max(fw.x, fw.y);
		float avg = 1.0 - (1.0 - 2.0 * hw) * (1.0 - 2.0 * hw);
		on = mix(avg, on, clamp((cellPx - 3.0) / 6.0, 0.0, 1.0));
		color = uLine * on + color * (1.0 - uLine.a * on);
	}
	outColor = color;
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
	const s = gl.createShader(type);
	if (!s) throw new Error("shader");
	gl.shaderSource(s, src);
	gl.compileShader(s);
	if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "");
	return s;
}

/** Builds a program from the two sources (throws with the log on failure). */
export function linkProgram(
	gl: WebGL2RenderingContext,
	vertex: string,
	fragment: string,
): WebGLProgram {
	const program = gl.createProgram();
	if (!program) throw new Error("program");
	const vs = compile(gl, gl.VERTEX_SHADER, vertex);
	const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
	gl.attachShader(program, vs);
	gl.attachShader(program, fs);
	gl.linkProgram(program);
	gl.deleteShader(vs);
	gl.deleteShader(fs);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error(gl.getProgramInfoLog(program) ?? "");
	}
	return program;
}

export interface GroundLook {
	/** Premultiplied RGBA 0…1. */
	background: [number, number, number, number];
	line: [number, number, number, number];
	grid: boolean;
	/** Grid line width, world units (the flat grid's 1 px at the view's zoom). */
	lineWidth: number;
}

/** Draws the ground in one GL context. */
export class GroundPainter {
	private readonly program: WebGLProgram;
	private readonly vao: WebGLVertexArrayObject;
	private readonly buffer: WebGLBuffer;
	private readonly u: Record<string, WebGLUniformLocation | null> = {};

	constructor(private readonly gl: WebGL2RenderingContext) {
		this.program = linkProgram(gl, VERTEX, FRAGMENT);
		for (const name of ["uView", "uBackground", "uLine", "uGrid", "uGridSize", "uLineWidth"]) {
			this.u[name] = gl.getUniformLocation(this.program, name);
		}
		const vao = gl.createVertexArray();
		const buffer = gl.createBuffer();
		if (!vao || !buffer) throw new Error("gl objects");
		this.vao = vao;
		this.buffer = buffer;
		gl.bindVertexArray(vao);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
		gl.bindVertexArray(null);
	}

	draw(frame: View3dGlFrame, look: GroundLook): void {
		const { gl, u } = this;
		const { viewport, stage } = frame.view;
		const region = groundRegionPx(
			frame.drawDistance,
			viewport.zoom,
			stage.width,
			stage.height,
			frame.amount,
		);
		const corners = stageRectWorld(region, viewport);
		// Vertices relative to a grid-aligned origin near them: float32 keeps the precision,
		// and the grid lines stay on the world's.
		const cx = (corners[0].x + corners[2].x) / 2;
		const cy = (corners[0].y + corners[2].y) / 2;
		const origin = {
			x: Math.round(cx / GROUND_GRID_SIZE) * GROUND_GRID_SIZE,
			y: Math.round(cy / GROUND_GRID_SIZE) * GROUND_GRID_SIZE,
		};
		const v = new Float32Array(12);
		const order = [0, 1, 2, 0, 2, 3];
		order.forEach((k, i) => {
			v[i * 2] = corners[k].x - origin.x;
			v[i * 2 + 1] = corners[k].y - origin.y;
		});
		// biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook
		gl.useProgram(this.program);
		gl.bindVertexArray(this.vao);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
		gl.bufferData(gl.ARRAY_BUFFER, v, gl.DYNAMIC_DRAW);
		gl.uniformMatrix4fv(u.uView, false, viewMatrix(frame.view, origin));
		gl.uniform4fv(u.uBackground, look.background);
		gl.uniform4fv(u.uLine, look.line);
		gl.uniform1f(u.uGrid, look.grid ? 1 : 0);
		gl.uniform1f(u.uGridSize, GROUND_GRID_SIZE);
		gl.uniform1f(u.uLineWidth, look.lineWidth);
		gl.depthMask(false);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
		gl.depthMask(true);
		gl.bindVertexArray(null);
	}

	release(): void {
		const { gl } = this;
		gl.deleteBuffer(this.buffer);
		gl.deleteVertexArray(this.vao);
		gl.deleteProgram(this.program);
	}
}
