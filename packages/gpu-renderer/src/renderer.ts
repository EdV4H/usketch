import type { GpuPrimitive, ShapeData, ShapeRegistry, Viewport } from "@edv4h/usketch-shared";
import type { GpuContext } from "./gpu-context.js";
import { createPolylinePipeline, type PolylinePipeline } from "./pipelines/polyline-pipeline.js";
import { createShapeSdfPipeline, type ShapeSdfPipeline } from "./pipelines/shape-sdf-pipeline.js";

export interface GpuRenderer {
	setViewport(viewport: Viewport, canvasWidth: number, canvasHeight: number): void;
	render(shapes: ReadonlyMap<string, ShapeData>, shapeRegistry: ShapeRegistry): Set<string>;
	destroy(): void;
}

export function createGpuRenderer(ctx: GpuContext): GpuRenderer {
	const { device } = ctx;

	const uniformBuffer = device.createBuffer({
		size: 80,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});

	const shapeSdfPipeline: ShapeSdfPipeline = createShapeSdfPipeline(ctx);
	const polylinePipeline: PolylinePipeline = createPolylinePipeline(ctx);

	let currentViewport: Viewport = { x: 0, y: 0, zoom: 1 };
	let canvasW = 1;
	let canvasH = 1;

	function updateUniforms() {
		const vp = currentViewport;
		const left = -vp.x / vp.zoom;
		const right = (canvasW - vp.x) / vp.zoom;
		const top = -vp.y / vp.zoom;
		const bottom = (canvasH - vp.y) / vp.zoom;

		const sx = 2.0 / (right - left);
		const sy = 2.0 / (top - bottom);
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
			const sdfShapes: GpuPrimitive[] = [];
			const polylines: GpuPrimitive[] = [];
			const claimedIds = new Set<string>();

			for (const [id, shape] of shapes) {
				const def = shapeRegistry.get(shape.type);
				if (!def?.gpuPrimitive) continue;
				const prim = def.gpuPrimitive(shape);
				if (!prim) continue;

				claimedIds.add(id);
				if (prim.kind === "rect" || prim.kind === "ellipse") {
					sdfShapes.push(prim);
				} else if (prim.kind === "polyline") {
					polylines.push(prim);
				}
			}

			// Render
			const texture = ctx.gpuCtx.getCurrentTexture();
			const view = texture.createView();
			const encoder = device.createCommandEncoder();

			shapeSdfPipeline.render(encoder, view, uniformBuffer, sdfShapes);
			polylinePipeline.render(encoder, view, uniformBuffer, polylines);

			device.queue.submit([encoder.finish()]);

			return claimedIds;
		},

		destroy() {
			shapeSdfPipeline.destroy();
			polylinePipeline.destroy();
			uniformBuffer.destroy();
		},
	};
}
