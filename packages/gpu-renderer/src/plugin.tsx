import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { type GpuContext, initGpuContext } from "./gpu-context.js";
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

		async setup(ctx: PluginContext) {
			if (!navigator.gpu) {
				if (mode === "force") {
					throw new Error("WebGPU is not supported in this browser");
				}
				return;
			}

			// Create a canvas element that will be used for GPU rendering.
			// We insert it into the DOM via a fixed layer.
			const canvas = document.createElement("canvas");
			canvas.style.cssText =
				"position:absolute;inset:0;width:100%;height:100%;pointer-events:none;";

			let gpuContext: GpuContext | null = null;

			try {
				gpuContext = await initGpuContext(canvas);
			} catch {
				if (mode === "force") {
					throw new Error("Failed to initialize WebGPU");
				}
				return;
			}

			if (!gpuContext) {
				if (mode === "force") {
					throw new Error("Failed to initialize WebGPU context");
				}
				return;
			}

			const gpuCtx = gpuContext;

			// Register a fixed layer that holds the canvas element
			ctx.layers.register({
				id: "gpu-canvas",
				order: 10,
				fixed: true,
				render: () => null,
			});

			// Register the GPU shape layer (below DOM shapes at order 50)
			ctx.layers.register({
				id: "gpu-shapes",
				order: 11,
				fixed: true,
				render: (renderCtx) => (
					<GpuShapeLayer
						ctx={renderCtx}
						shapeRegistry={ctx.shapes}
						gpuContext={gpuCtx}
						events={ctx.events}
					/>
				),
			});

			// Insert canvas into the canvas container after it mounts
			// We need to find the parent layer div and insert our canvas there
			requestAnimationFrame(() => {
				const layerDiv = document.querySelector('[data-layer-id="gpu-canvas"]');
				if (layerDiv) {
					layerDiv.appendChild(canvas);
				}
			});

			cleanup = () => {
				ctx.layers.unregister("gpu-shapes");
				ctx.layers.unregister("gpu-canvas");
				canvas.remove();
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}
