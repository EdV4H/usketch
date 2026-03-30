import type { GpuPrimitive } from "@edv4h/usketch-shared";
import type { GpuContext } from "../gpu-context.js";
import { RECT_SHADER } from "../shaders/rect.js";

// Per-instance data layout: 12 floats = 48 bytes
// posSize(4) + fillColor(4) + strokeColor(4) + params(4) = 16 floats = 64 bytes
const INSTANCE_FLOATS = 16;
const INSTANCE_BYTES = INSTANCE_FLOATS * 4;
const MAX_INSTANCES = 16384;

export interface RectPipeline {
	render(
		encoder: GPUCommandEncoder,
		view: GPUTextureView,
		uniforms: GPUBuffer,
		rects: GpuPrimitive[],
	): void;
	destroy(): void;
}

export function createRectPipeline(ctx: GpuContext): RectPipeline {
	const { device, format } = ctx;

	const shaderModule = device.createShaderModule({ code: RECT_SHADER });

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

	return {
		render(encoder, view, uniformBuffer, rects) {
			if (rects.length === 0) return;
			const count = Math.min(rects.length, MAX_INSTANCES);

			// Write instance data
			const data = new Float32Array(count * INSTANCE_FLOATS);
			for (let i = 0; i < count; i++) {
				const r = rects[i];
				const off = i * INSTANCE_FLOATS;
				// posSize
				data[off + 0] = r.bounds.x;
				data[off + 1] = r.bounds.y;
				data[off + 2] = r.bounds.width;
				data[off + 3] = r.bounds.height;
				// fillColor
				data[off + 4] = r.fill[0];
				data[off + 5] = r.fill[1];
				data[off + 6] = r.fill[2];
				data[off + 7] = r.fill[3];
				// strokeColor
				data[off + 8] = r.stroke[0];
				data[off + 9] = r.stroke[1];
				data[off + 10] = r.stroke[2];
				data[off + 11] = r.stroke[3];
				// params: cornerRadius, strokeWidth, opacity, rotation
				data[off + 12] = r.cornerRadius ?? 0;
				data[off + 13] = r.strokeWidth;
				data[off + 14] = r.opacity;
				data[off + 15] = r.rotation ?? 0;
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
						clearValue: { r: 0, g: 0, b: 0, a: 0 },
						loadOp: "clear",
						storeOp: "store",
					},
				],
			});

			pass.setPipeline(pipeline);
			pass.setBindGroup(0, bindGroup);
			pass.draw(4, count, 0, 0);
			pass.end();
		},

		destroy() {
			instanceBuffer.destroy();
		},
	};
}
