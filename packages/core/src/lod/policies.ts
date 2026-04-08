import type { LodPolicy, LodPolicyContext, RenderMode } from "@edv4h/usketch-shared";

interface HysteresisOptions {
	/** Threshold to enter LOD mode (when current mode is interactive). */
	enterAt?: number;
	/** Threshold to exit LOD mode (when current mode is lod). */
	exitAt?: number;
}

/**
 * Switch to `lod` when zoom drops below `enterAt`, switch back to `interactive`
 * when zoom rises above `exitAt`. Defaults: enter at 0.5, exit at 0.7.
 */
export function createZoomLodPolicy(opts: HysteresisOptions = {}): LodPolicy {
	const enterAt = opts.enterAt ?? 0.5;
	const exitAt = opts.exitAt ?? 0.7;
	return {
		id: "lod-policy:zoom",
		evaluate(ctx: LodPolicyContext): RenderMode {
			if (ctx.currentMode === "lod") {
				return ctx.viewport.zoom > exitAt ? "interactive" : "lod";
			}
			return ctx.viewport.zoom < enterAt ? "lod" : "interactive";
		},
	};
}

/**
 * Switch to `lod` when shape count exceeds `enterAt`, back to `interactive`
 * when it drops below `exitAt`. Defaults: enter at 1000, exit at 800.
 */
export function createShapeCountLodPolicy(opts: HysteresisOptions = {}): LodPolicy {
	const enterAt = opts.enterAt ?? 1000;
	const exitAt = opts.exitAt ?? 800;
	return {
		id: "lod-policy:shape-count",
		evaluate(ctx: LodPolicyContext): RenderMode {
			if (ctx.currentMode === "lod") {
				return ctx.shapeCount < exitAt ? "interactive" : "lod";
			}
			return ctx.shapeCount > enterAt ? "lod" : "interactive";
		},
	};
}

/**
 * Switch to `lod` when smoothed FPS drops below `enterAt`, back to
 * `interactive` when it recovers above `exitAt`. FPS is the closest
 * proxy for CPU/GPU load available in the browser. Defaults: 30 / 50.
 */
export function createFpsLodPolicy(opts: HysteresisOptions = {}): LodPolicy {
	const enterAt = opts.enterAt ?? 30;
	const exitAt = opts.exitAt ?? 50;
	return {
		id: "lod-policy:fps",
		evaluate(ctx: LodPolicyContext): RenderMode {
			if (ctx.currentMode === "lod") {
				return ctx.fps > exitAt ? "interactive" : "lod";
			}
			return ctx.fps < enterAt ? "lod" : "interactive";
		},
	};
}

/**
 * Combine multiple policies. If any child policy demands `lod`, the composite
 * returns `lod`. `gpu-only` is preserved if any child returns it (and no child
 * returns `lod`). Otherwise returns `interactive`.
 */
export function createCompositeLodPolicy(policies: readonly LodPolicy[]): LodPolicy {
	return {
		id: "lod-policy:composite",
		evaluate(ctx: LodPolicyContext): RenderMode {
			let result: RenderMode = "interactive";
			for (const p of policies) {
				const r = p.evaluate(ctx);
				if (r === "lod") return "lod";
				if (r === "gpu-only") result = "gpu-only";
			}
			return result;
		},
	};
}
