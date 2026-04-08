import type { LodController, LodPolicy, LodPolicyContext, RenderMode } from "@edv4h/usketch-shared";

export interface LodControllerInternal extends LodController {
	/** Called by the canvas render loop on each frame with the latest context. */
	tick(ctx: LodPolicyContext): void;
	destroy(): void;
}

export interface CreateLodControllerOptions {
	policy: LodPolicy;
	initialMode?: RenderMode;
}

/**
 * Create a LOD controller. The controller owns the current `RenderMode` and a
 * pluggable `LodPolicy`. Each frame the canvas calls `tick(ctx)` with the
 * latest viewport / shape count / fps; the policy decides the next mode.
 *
 * Listeners registered via `onModeChange` are notified only when the mode
 * actually changes (not every tick).
 */
export function createLodController(opts: CreateLodControllerOptions): LodControllerInternal {
	let currentMode: RenderMode = opts.initialMode ?? "interactive";
	let policy: LodPolicy = opts.policy;
	let manualOverride: RenderMode | null = null;
	const listeners = new Set<(mode: RenderMode) => void>();

	function notify(mode: RenderMode): void {
		for (const listener of listeners) listener(mode);
	}

	function applyMode(next: RenderMode): void {
		if (next === currentMode) return;
		currentMode = next;
		notify(next);
	}

	return {
		getMode(): RenderMode {
			return currentMode;
		},
		onModeChange(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		setPolicy(next: LodPolicy) {
			policy = next;
		},
		setManualOverride(mode) {
			manualOverride = mode;
			if (mode !== null) applyMode(mode);
		},
		tick(ctx) {
			if (manualOverride !== null) return;
			const next = policy.evaluate({ ...ctx, currentMode });
			applyMode(next);
		},
		destroy() {
			listeners.clear();
		},
	};
}
