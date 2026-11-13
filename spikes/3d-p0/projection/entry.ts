// P0(c): do the three copies of the Mode 7 projection agree?
//   1. CSS: the tilt rule mode7 applies (`tiltTransform` + camera-height translateZ),
//      measured by the browser (getBoundingClientRect of a tiny box at each point)
//   2. TS: mode7 `projectToGround` and elevation `projectLifted`
//   3. GLSL: elevation's real vertex shader, run with transform feedback
// Run: node run.cjs (bundles this file, opens it in headless Chromium).
import { projectToGround } from "../../../plugins/usketch-plugin-mode7/src/mode7-projection.js";
import { tiltTransform } from "../../../plugins/usketch-plugin-mode7/src/mode7-transform.js";
import { projectLifted } from "../../../plugins/usketch-plugin-elevation/src/elevation-mesh.js";

declare const VERTEX_SOURCE: string;

type Cam = { pitch: number; yaw: number; fov: number; horizon: number; heightPx: number };
const SIZE = { width: 1280, height: 800 };
const CAMS: Cam[] = [
	{ pitch: 55, yaw: 0, fov: 600, horizon: 0.45, heightPx: 0 },
	{ pitch: 70, yaw: 30, fov: 400, horizon: 0.3, heightPx: 120 },
	{ pitch: 30, yaw: -120, fov: 1200, horizon: 0.6, heightPx: -40 },
	{ pitch: 84, yaw: 179, fov: 200, horizon: 0.1, heightPx: 300 },
];
const ZS = [0, 40, 250];
// Flat-stage points: a grid over the stage plus some far above it (the far ground).
const POINTS: { x: number; y: number }[] = [];
for (let y = -1600; y <= 800; y += 200) for (let x = -400; x <= 1680; x += 260) POINTS.push({ x, y });

type P = { x: number; y: number } | null;

function cssProject(cam: Cam): P[][] {
	const stage = document.createElement("div");
	stage.style.cssText = `position:absolute;left:0;top:0;width:${SIZE.width}px;height:${SIZE.height}px;`;
	const tilt = tiltTransform(cam);
	const wrap = document.createElement("div");
	wrap.style.cssText = `position:absolute;inset:0;transform-style:preserve-3d;transform:${tilt.transform} translateZ(${-cam.heightPx}px);transform-origin:${tilt.transformOrigin};`;
	stage.appendChild(wrap);
	document.body.appendChild(stage);
	const boxes: HTMLDivElement[][] = ZS.map((z) =>
		POINTS.map((p) => {
			const b = document.createElement("div");
			// 0.2px box centred on the point (a 0x0 box is dropped by Chrome under 3D).
			b.style.cssText = `position:absolute;left:0;top:0;width:0.2px;height:0.2px;transform:translate3d(${p.x - 0.1}px,${p.y - 0.1}px,${z}px);`;
			wrap.appendChild(b);
			return b;
		}),
	);
	const out = boxes.map((row, zi) =>
		row.map((b, i) => {
			const r = b.getBoundingClientRect();
			// Points at/behind the eye: the TS side says null; the browser draws garbage.
			if (projectToGround(POINTS[i].x, POINTS[i].y, cam, SIZE, ZS[zi]) === null) return null;
			if (r.width === 0 && r.height === 0) return null;
			return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
		}),
	);
	stage.remove();
	return out;
}

function glProject(cam: Cam, zoom: number, rotationDeg: number): P[][] {
	const canvas = document.createElement("canvas");
	const gl = canvas.getContext("webgl2");
	if (!gl) throw new Error("no webgl2");
	const vsSrc = VERTEX_SOURCE.replace("out vec2 vLocal;", "out vec2 vLocal;\nout vec4 vPos;").replace(
		/vLocal = aVertex\.xy;\n\}/,
		"vLocal = aVertex.xy;\n\tvPos = gl_Position;\n}",
	);
	const fsSrc = "#version 300 es\nprecision highp float;\nout vec4 c;\nvoid main(){c=vec4(1);}";
	const sh = (type: number, src: string) => {
		const s = gl.createShader(type)!;
		gl.shaderSource(s, src);
		gl.compileShader(s);
		if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "");
		return s;
	};
	const prog = gl.createProgram()!;
	gl.attachShader(prog, sh(gl.VERTEX_SHADER, vsSrc));
	gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fsSrc));
	gl.transformFeedbackVaryings(prog, ["vPos"], gl.INTERLEAVED_ATTRIBS);
	gl.linkProgram(prog);
	if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "");
	gl.useProgram(prog);
	const r = Math.PI / 180;
	const rot = rotationDeg * r;
	const U = (n: string) => gl.getUniformLocation(prog, n);
	// The tile corner at the flat stage origin; local coords are world units.
	gl.uniform2f(U("uOrigin"), 0, 0);
	gl.uniform2f(U("uAxis"), zoom * Math.cos(rot), zoom * Math.sin(rot));
	gl.uniform1f(U("uZoom"), zoom);
	gl.uniform2f(U("uPivot"), SIZE.width / 2, SIZE.height * cam.horizon);
	gl.uniform4f(U("uCam"), Math.cos(cam.yaw * r), Math.sin(cam.yaw * r), Math.cos(cam.pitch * r), Math.sin(cam.pitch * r));
	gl.uniform1f(U("uFov"), cam.fov);
	gl.uniform1f(U("uCameraHeight"), cam.heightPx);
	gl.uniform2f(U("uSize"), SIZE.width, SIZE.height);
	gl.uniform1f(U("uWater"), -1);
	const out: P[][] = [];
	for (const z of ZS) {
		// World point whose flat-stage position is POINTS[i]: invert s = R·zoom·local.
		const data = new Float32Array(POINTS.length * 4);
		POINTS.forEach((p, i) => {
			const lx = (p.x * Math.cos(rot) + p.y * Math.sin(rot)) / zoom;
			const ly = (-p.x * Math.sin(rot) + p.y * Math.cos(rot)) / zoom;
			data.set([lx, ly, z / zoom, 0], i * 4);
		});
		const vbo = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
		gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
		const loc = gl.getAttribLocation(prog, "aVertex");
		gl.enableVertexAttribArray(loc);
		gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
		const tfb = gl.createBuffer();
		gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, tfb);
		gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, POINTS.length * 16, gl.STATIC_READ);
		const tf = gl.createTransformFeedback();
		gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
		gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, tfb);
		gl.enable(gl.RASTERIZER_DISCARD);
		gl.beginTransformFeedback(gl.POINTS);
		gl.drawArrays(gl.POINTS, 0, POINTS.length);
		gl.endTransformFeedback();
		gl.disable(gl.RASTERIZER_DISCARD);
		const res = new Float32Array(POINTS.length * 4);
		gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, res);
		out.push(
			POINTS.map((_, i) => {
				const [cx, cy, , w] = res.subarray(i * 4, i * 4 + 4);
				if (!(w > 0)) return null;
				return { x: ((cx / w + 1) / 2) * SIZE.width, y: ((1 - cy / w) / 2) * SIZE.height };
			}),
		);
	}
	return out;
}

function maxErr(a: P[][], b: P[][], cam?: Cam): { max: number; compared: number; nullMismatch: number; worst?: unknown } {
	let max = 0;
	let worst: unknown;
	let compared = 0;
	let nullMismatch = 0;
	a.forEach((row, zi) =>
		row.forEach((p, i) => {
			const q = b[zi][i];
			// Only points drawn on (or near) the stage: far off-screen points next to the
			// eye are magnified 40x+, where float32 rounding alone is several px.
			if (p && (p.x < -SIZE.width || p.x > 2 * SIZE.width || p.y < -SIZE.height || p.y > 2 * SIZE.height)) return;
			if (!p || !q) {
				if (!p !== !q) nullMismatch++;
				return;
			}
			compared++;
			const e = Math.hypot(p.x - q.x, p.y - q.y);
			if (e > max && cam) worst = { pt: POINTS[i], z: ZS[zi], ts: p, other: q, scale: projectToGround(POINTS[i].x, POINTS[i].y, cam, SIZE, ZS[zi])?.scale };
			max = Math.max(max, e);
		}),
	);
	return { max, compared, nullMismatch, worst };
}

const results = CAMS.map((cam) => {
	const ts: P[][] = ZS.map((z) => POINTS.map((p) => projectToGround(p.x, p.y, cam, SIZE, z)));
	const lifted: P[][] = ZS.map((z) => POINTS.map((p) => projectLifted(p.x, p.y, z, cam, SIZE)));
	const css = cssProject(cam);
	const gl = glProject(cam, 1, 0);
	const glZoomRot = glProject(cam, 2.5, 37);
	return {
		cam,
		"ts vs elevation-ts": maxErr(ts, lifted),
		"ts vs css": maxErr(ts, css, cam),
		"ts vs glsl": maxErr(ts, gl),
		"ts vs glsl (zoom 2.5, rotation 37)": maxErr(ts, glZoomRot),
	};
});
(window as unknown as { __results: unknown }).__results = results;
