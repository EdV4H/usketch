import type { GpuPrimitive, ShapeData, ShapeRegistry, Viewport } from "@edv4h/usketch-shared";
import type { GpuContext } from "./gpu-context.js";
import { createPolylinePipeline, type PolylinePipeline } from "./pipelines/polyline-pipeline.js";
import { createShapeSdfPipeline, type ShapeSdfPipeline } from "./pipelines/shape-sdf-pipeline.js";

export interface GpuRenderOptions {
	selection: ReadonlySet<string>;
	hoveredId: string | null;
}

export interface GpuRenderStats {
	gpuShapeCount: number;
	sdfCount: number;
	polylineCount: number;
}

export interface GpuRenderer {
	setViewport(viewport: Viewport, canvasWidth: number, canvasHeight: number): void;
	/**
	 * Render shapes in the given order (caller is expected to pass a z-sorted array).
	 * Returns the set of shape IDs that were successfully rendered by GPU so the
	 * DOM renderer can skip them.
	 */
	render(
		shapes: readonly ShapeData[],
		shapeRegistry: ShapeRegistry,
		options: GpuRenderOptions,
	): { claimedIds: Set<string>; stats: GpuRenderStats };
	destroy(): void;
}

const MAX_SHAPE_SIZE = 100000;

function isValidPrimitive(prim: GpuPrimitive): boolean {
	const { bounds } = prim;
	// Skip zero-size shapes
	if (bounds.width <= 0 || bounds.height <= 0) return false;
	// Skip NaN/Infinity
	if (
		!Number.isFinite(bounds.x) ||
		!Number.isFinite(bounds.y) ||
		!Number.isFinite(bounds.width) ||
		!Number.isFinite(bounds.height)
	) {
		return false;
	}
	// Skip extremely large shapes
	if (bounds.width > MAX_SHAPE_SIZE || bounds.height > MAX_SHAPE_SIZE) return false;
	// Skip invalid opacity/strokeWidth
	if (!Number.isFinite(prim.opacity) || !Number.isFinite(prim.strokeWidth)) return false;
	return true;
}

// Selection highlight color: blue outline
const SELECTION_COLOR: [number, number, number, number] = [0.2, 0.5, 1.0, 1.0];
const SELECTION_STROKE_WIDTH = 2;
// Hover highlight color: lighter blue
const HOVER_COLOR: [number, number, number, number] = [0.4, 0.65, 1.0, 0.6];
const HOVER_STROKE_WIDTH = 1.5;

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

		render(shapes, shapeRegistry, options) {
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
			const highlightShapes: GpuPrimitive[] = [];
			const claimedIds = new Set<string>();

			for (const shape of shapes) {
				const id = shape.id;
				const def = shapeRegistry.get(shape.type);
				if (!def?.gpuPrimitive) continue;
				const prim = def.gpuPrimitive(shape);
				if (!prim) continue;
				if (!isValidPrimitive(prim)) continue;

				claimedIds.add(id);
				if (prim.kind === "rect" || prim.kind === "ellipse") {
					sdfShapes.push(prim);
				} else if (prim.kind === "polyline") {
					polylines.push(prim);
				}

				// Selection / hover highlight
				const isSelected = options.selection.has(id);
				const isHovered = options.hoveredId === id && !isSelected;

				if (isSelected || isHovered) {
					const color = isSelected ? SELECTION_COLOR : HOVER_COLOR;
					const sw = isSelected ? SELECTION_STROKE_WIDTH : HOVER_STROKE_WIDTH;
					highlightShapes.push({
						kind: prim.kind === "polyline" ? "rect" : prim.kind,
						bounds: prim.bounds,
						cornerRadius: prim.cornerRadius,
						fill: [0, 0, 0, 0],
						stroke: color,
						strokeWidth: sw,
						opacity: 1,
						rotation: prim.rotation,
					});
				}
			}

			// Render
			const texture = ctx.gpuCtx.getCurrentTexture();
			const view = texture.createView();
			const encoder = device.createCommandEncoder();

			// Append highlights after shapes so they render on top
			const allSdfShapes =
				highlightShapes.length > 0 ? [...sdfShapes, ...highlightShapes] : sdfShapes;

			shapeSdfPipeline.render(encoder, view, uniformBuffer, allSdfShapes);
			polylinePipeline.render(encoder, view, uniformBuffer, polylines);

			device.queue.submit([encoder.finish()]);

			return {
				claimedIds,
				stats: {
					gpuShapeCount: claimedIds.size,
					sdfCount: sdfShapes.length,
					polylineCount: polylines.length,
				},
			};
		},

		destroy() {
			shapeSdfPipeline.destroy();
			polylinePipeline.destroy();
			uniformBuffer.destroy();
		},
	};
}
