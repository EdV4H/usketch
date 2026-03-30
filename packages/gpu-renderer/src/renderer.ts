import type { GpuPrimitive, ShapeData, ShapeRegistry, Viewport } from "@edv4h/usketch-shared";
import type { GpuContext } from "./gpu-context.js";
import { createRectPipeline, type RectPipeline } from "./pipelines/rect-pipeline.js";

export interface GpuRenderer {
	/** Update viewport for the camera matrix. */
	setViewport(viewport: Viewport, canvasWidth: number, canvasHeight: number): void;
	/** Collect GPU primitives from shapes and render. */
	render(shapes: ReadonlyMap<string, ShapeData>, shapeRegistry: ShapeRegistry): Set<string>;
	destroy(): void;
}

export function createGpuRenderer(ctx: GpuContext): GpuRenderer {
	const { device } = ctx;

	// Uniform buffer: mat4x4 (64 bytes) + resolution (8 bytes) + padding (8 bytes) = 80 bytes
	const uniformBuffer = device.createBuffer({
		size: 80,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});

	const rectPipeline: RectPipeline = createRectPipeline(ctx);

	let currentViewport: Viewport = { x: 0, y: 0, zoom: 1 };
	let canvasW = 1;
	let canvasH = 1;

	function updateUniforms() {
		// Build an orthographic projection that maps world coordinates to clip space,
		// incorporating the viewport pan and zoom.
		const vp = currentViewport;
		// World-space bounds visible on screen:
		// left = -vp.x / vp.zoom, right = (canvasW - vp.x) / vp.zoom
		// top = -vp.y / vp.zoom, bottom = (canvasH - vp.y) / vp.zoom
		const left = -vp.x / vp.zoom;
		const right = (canvasW - vp.x) / vp.zoom;
		const top = -vp.y / vp.zoom;
		const bottom = (canvasH - vp.y) / vp.zoom;

		// Orthographic projection matrix (column-major for WebGPU)
		const sx = 2.0 / (right - left);
		const sy = 2.0 / (top - bottom); // flip Y
		const tx = -(right + left) / (right - left);
		const ty = -(top + bottom) / (top - bottom);

		const mat = new Float32Array([sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, 1, 0, tx, ty, 0, 1]);

		const buf = new ArrayBuffer(80);
		new Float32Array(buf, 0, 16).set(mat);
		const res = new Float32Array(buf, 64, 2);
		res[0] = canvasW;
		res[1] = canvasH;

		device.queue.writeBuffer(uniformBuffer, 0, buf);
	}

	return {
		setViewport(viewport, width, height) {
			currentViewport = viewport;
			canvasW = width;
			canvasH = height;
		},

		render(shapes, shapeRegistry) {
			// Resize canvas to match display size
			const canvas = ctx.canvas;
			const dpr = globalThis.devicePixelRatio ?? 1;
			const displayW = Math.round(canvas.clientWidth * dpr);
			const displayH = Math.round(canvas.clientHeight * dpr);
			if (canvas.width !== displayW || canvas.height !== displayH) {
				canvas.width = displayW;
				canvas.height = displayH;
				ctx.gpuCtx.configure({
					device,
					format: ctx.format,
					alphaMode: "premultiplied",
				});
			}
			canvasW = canvas.clientWidth;
			canvasH = canvas.clientHeight;

			updateUniforms();

			// Collect GPU primitives
			const rects: GpuPrimitive[] = [];
			const claimedIds = new Set<string>();

			for (const [id, shape] of shapes) {
				const def = shapeRegistry.get(shape.type);
				if (!def?.gpuPrimitive) continue;
				const prim = def.gpuPrimitive(shape);
				if (!prim) continue;

				claimedIds.add(id);
				if (prim.kind === "rect") {
					rects.push(prim);
				}
				// ellipse, polyline, polygon will be added in Phase 2
			}

			// Render
			const texture = ctx.gpuCtx.getCurrentTexture();
			const view = texture.createView();
			const encoder = device.createCommandEncoder();

			rectPipeline.render(encoder, view, uniformBuffer, rects);

			device.queue.submit([encoder.finish()]);

			return claimedIds;
		},

		destroy() {
			rectPipeline.destroy();
			uniformBuffer.destroy();
		},
	};
}
