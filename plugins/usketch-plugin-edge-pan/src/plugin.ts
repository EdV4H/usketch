import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { createResolver, type EdgePanAxes, type EdgePanOptions } from "./edge-pan-config.js";
import { setupEdgePan } from "./edge-pan-runtime.js";
import { registerEdgePanHud } from "./register-edge-pan-hud.js";

/** end-user が HUD から上書きできるフィールド。 */
type Overrides = { enabled?: boolean; edgeSize?: number; maxSpeed?: number; axes?: EdgePanAxes };

/**
 * Shape をドラッグ中、ポインタを画角の端に寄せると画角がその方向へ自動スライドするプラグイン。
 *
 * すべての挙動（有効/端の帯サイズ/最大速度/対象軸/速度カーブ）はホストが `options` で設定でき、
 * 数値・真偽・enum は getter（`() => value`）でライブ変更も可能。加えて end-user は HUD からも
 * 上書きできる（HUD の上書きが options より優先）。
 */
export function createEdgePanPlugin(options: EdgePanOptions = {}): UsketchPlugin {
	const overrides: Overrides = {};
	const listeners = new Set<() => void>();
	const notify = () => {
		for (const listener of listeners) listener();
	};

	const resolve = createResolver(options, overrides);

	return {
		id: "usketch-plugin-edge-pan",
		name: "端で画角スライド",

		setup(ctx: PluginContext) {
			const teardownRuntime = setupEdgePan(ctx, resolve);
			const teardownHud = registerEdgePanHud(ctx, {
				resolve,
				setOverride: (name, value) => {
					(overrides as Record<string, unknown>)[name] = value;
					notify();
				},
				subscribe: (listener) => {
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
			});

			return () => {
				teardownRuntime();
				teardownHud();
				listeners.clear();
			};
		},
	};
}
