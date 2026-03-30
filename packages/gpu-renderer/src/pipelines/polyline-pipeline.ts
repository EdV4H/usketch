import type { GpuPrimitive } from "@edv4h/usketch-shared";
import type { GpuContext } from "../gpu-context.js";
import { POLYLINE_SHADER } from "../shaders/polyline.js";
import { tessellatePolyline } from "../utils/tessellation.js";

const MAX_VERTICES = 65536;
const FLOATS_PER_VERTEX = 7; // x, y, r, g, b, a, opacity

export interface PolylinePipeline {
	render(
		encoder: GPUCommandEncoder,
		view: GPUTextureView,
		uniforms: GPUBuffer,
		polylines: GpuPrimitive[],
	): void;
	destroy(): void;
}

export function createPolylinePipeline(ctx: GpuContext): PolylinePipeline {
	const { device, format } = ctx;

	const shaderModule = device.createShaderModule({ code: POLYLINE_SHADER });

	const bindGroupLayout = device.createBindGroupLayout({
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX,
				buffer: { type: "uniform" },
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
			buffers: [
				{
					arrayStride: FLOATS_PER_VERTEX * 4,
					attributes: [
						{ shaderLocation: 0, offset: 0, format: "float32x2" }, // position
						{ shaderLocation: 1, offset: 8, format: "float32x4" }, // color
						{ shaderLocation: 2, offset: 24, format: "float32" }, // opacity
					],
				},
			],
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
		},
	});

	const vertexBuffer = device.createBuffer({
		size: MAX_VERTICES * FLOATS_PER_VERTEX * 4,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
	});

	return {
		render(encoder, view, uniformBuffer, polylines) {
			if (polylines.length === 0) return;

			const bindGroup = device.createBindGroup({
				layout: bindGroupLayout,
				entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
			});

			// We need a separate draw call per polyline since triangle strips can't be
			// concatenated without degenerate triangles. Use loadOp "load" to accumulate.
			const pass = encoder.beginRenderPass({
				colorAttachments: [
					{
						view,
						loadOp: "load",
						storeOp: "store",
					},
				],
			});
			pass.setPipeline(pipeline);
			pass.setBindGroup(0, bindGroup);

			for (const prim of polylines) {
				if (!prim.vertices || prim.vertices.length < 4) continue;

				const { vertices, vertexCount } = tessellatePolyline(
					prim.vertices,
					prim.strokeWidth * 0.5,
					prim.stroke,
					prim.opacity,
				);

				if (vertexCount === 0 || vertexCount > MAX_VERTICES) continue;

				device.queue.writeBuffer(
					vertexBuffer,
					0,
					vertices.buffer,
					vertices.byteOffset,
					vertices.byteLength,
				);
				pass.setVertexBuffer(0, vertexBuffer);
				pass.draw(vertexCount, 1, 0, 0);
			}

			pass.end();
		},

		destroy() {
			vertexBuffer.destroy();
		},
	};
}
