import type { GpuPrimitive } from "@edv4h/usketch-shared";
import type { GpuContext } from "../gpu-context.js";
import { SHAPE_SDF_SHADER } from "../shaders/shape-sdf.js";

// Per-instance data layout: 16 floats = 64 bytes
const INSTANCE_FLOATS = 16;
const INSTANCE_BYTES = INSTANCE_FLOATS * 4;
const MAX_INSTANCES = 16384;

// Shape kind encoding (stored in params.w)
const KIND_RECT = 0.0;
const KIND_ELLIPSE = 1.0;

export interface ShapeSdfPipeline {
	render(
		encoder: GPUCommandEncoder,
		view: GPUTextureView,
		uniforms: GPUBuffer,
		shapes: GpuPrimitive[],
	): void;
	/** Render shapes on top of existing content (loadOp: "load"). */
	renderOverlay(
		encoder: GPUCommandEncoder,
		view: GPUTextureView,
		uniforms: GPUBuffer,
		shapes: GpuPrimitive[],
	): void;
	destroy(): void;
}

export function createShapeSdfPipeline(ctx: GpuContext): ShapeSdfPipeline {
	const { device, format } = ctx;

	const shaderModule = device.createShaderModule({ code: SHAPE_SDF_SHADER });

	const bindGroupLayout = device.createBindGroupLayout({
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: { type: "uniform" },
			},
			{
				binding: 1,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: { type: "read-only-storage" },
			},
		],
	});

	const pipelineLayout = device.createPipelineLayout({
		bindGroupLayouts: [bindGroupLayout],
	});

	const pipeline = device.createRenderPipeline({
		layout: pipelineLayout,
		vertex: {
			module: shaderModule,
			entryPoint: "vs_main",
		},
		fragment: {
			module: shaderModule,
			entryPoint: "fs_main",
			targets: [
				{
					format,
					blend: {
						color: {
							srcFactor: "src-alpha",
							dstFactor: "one-minus-src-alpha",
							operation: "add",
						},
						alpha: {
							srcFactor: "one",
							dstFactor: "one-minus-src-alpha",
							operation: "add",
						},
					},
				},
			],
		},
		primitive: {
			topology: "triangle-strip",
			stripIndexFormat: "uint32",
		},
	});

	const instanceBuffer = device.createBuffer({
		size: MAX_INSTANCES * INSTANCE_BYTES,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
	});

	function drawShapes(
		encoder: GPUCommandEncoder,
		view: GPUTextureView,
		uniformBuffer: GPUBuffer,
		shapes: GpuPrimitive[],
		loadOp: GPULoadOp,
	) {
		if (shapes.length === 0) return;
		const count = Math.min(shapes.length, MAX_INSTANCES);

		const data = new Float32Array(count * INSTANCE_FLOATS);
		for (let i = 0; i < count; i++) {
			const s = shapes[i];
			const off = i * INSTANCE_FLOATS;
			data[off + 0] = s.bounds.x;
			data[off + 1] = s.bounds.y;
			data[off + 2] = s.bounds.width;
			data[off + 3] = s.bounds.height;
			data[off + 4] = s.fill[0];
			data[off + 5] = s.fill[1];
			data[off + 6] = s.fill[2];
			data[off + 7] = s.fill[3];
			data[off + 8] = s.stroke[0];
			data[off + 9] = s.stroke[1];
			data[off + 10] = s.stroke[2];
			data[off + 11] = s.stroke[3];
			data[off + 12] = s.cornerRadius ?? 0;
			data[off + 13] = s.strokeWidth;
			data[off + 14] = s.opacity;
			data[off + 15] = s.kind === "ellipse" ? KIND_ELLIPSE : KIND_RECT;
		}
		device.queue.writeBuffer(instanceBuffer, 0, data);

		const bindGroup = device.createBindGroup({
			layout: bindGroupLayout,
			entries: [
				{ binding: 0, resource: { buffer: uniformBuffer } },
				{ binding: 1, resource: { buffer: instanceBuffer } },
			],
		});

		const pass = encoder.beginRenderPass({
			colorAttachments: [
				{
					view,
					...(loadOp === "clear"
						? { clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "clear" as const }
						: { loadOp: "load" as const }),
					storeOp: "store" as const,
				},
			],
		});

		pass.setPipeline(pipeline);
		pass.setBindGroup(0, bindGroup);
		pass.draw(4, count, 0, 0);
		pass.end();
	}

	return {
		render(encoder, view, uniformBuffer, shapes) {
			drawShapes(encoder, view, uniformBuffer, shapes, "clear");
		},

		renderOverlay(encoder, view, uniformBuffer, shapes) {
			drawShapes(encoder, view, uniformBuffer, shapes, "load");
		},

		destroy() {
			instanceBuffer.destroy();
		},
	};
}
