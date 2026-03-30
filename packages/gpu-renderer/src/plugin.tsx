import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { GpuShapeLayer } from "./gpu-shape-layer.js";

export interface GpuRendererPluginOptions {
	mode?: "auto" | "force";
}

export function createGpuRendererPlugin(options?: GpuRendererPluginOptions): UsketchPlugin {
	const mode = options?.mode ?? "auto";
	let cleanup: (() => void) | undefined;

	return {
		id: "usketch-gpu-renderer",
		name: "GPU Renderer",

		setup(ctx: PluginContext) {
			if (typeof navigator === "undefined" || !navigator.gpu) {
				if (mode === "force") {
					throw new Error("WebGPU is not supported in this browser");
				}
				return;
			}

			// Register GPU shape layer as fixed (GPU handles its own viewport transform)
			ctx.layers.register({
				id: "gpu-shapes",
				order: 10,
				fixed: true,
				render: (renderCtx) => (
					<GpuShapeLayer ctx={renderCtx} shapeRegistry={ctx.shapes} events={ctx.events} />
				),
			});

			cleanup = () => {
				ctx.layers.unregister("gpu-shapes");
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}
