import type { LayerRenderContext, PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { useRef, useSyncExternalStore } from "react";
import { toggleLiquidDisplacer } from "./displacer.js";
import { renderLiquidExportBackground } from "./export-background.js";
import { LiquidCanvas } from "./liquid-canvas.js";
import { createLiquidBgApi, LIQUID_BG_TYPE, liquidBgService } from "./liquid-service.js";
import { createLiquidState, type LiquidSettings, type LiquidState } from "./liquid-state.js";

function LiquidBackground({
	renderCtx,
	state,
}: {
	renderCtx: LayerRenderContext;
	state: LiquidState;
}) {
	const visible = useSyncExternalStore(state.subscribe, state.isVisible);
	// The canvas loop reads the newest viewport/shapes from here every frame.
	const latest = useRef(renderCtx);
	latest.current = renderCtx;
	if (!visible) return null;
	return (
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
			<LiquidCanvas renderCtx={latest} state={state} />
		</div>
	);
}

export interface LiquidBgPluginOptions {
	/** Initial settings (mode / viscosity / flow / color). */
	settings?: Partial<LiquidSettings>;
	/** Start with the liquid shown (emits `bg:set` `{ type: "liquid" }` on setup). Default false. */
	visible?: boolean;
}

/**
 * Background of thick, slowly flowing liquid that covers the board and is pushed
 * aside by displacer shapes (see {@link DisplacerMode}). Shown via the shared
 * `bg:set` event with `{ type: "liquid" }`, like the grid/dots backgrounds.
 */
export function createLiquidBgPlugin(options: LiquidBgPluginOptions = {}): UsketchPlugin {
	return {
		id: "usketch-plugin-bg-liquid",
		name: "Liquid Background",

		setup(ctx: PluginContext) {
			const state = createLiquidState(options.settings);
			// The background to return to when the liquid is switched off. Grid is the
			// app default (bg-grid starts visible).
			let previousType = "grid";

			ctx.layers.register({
				id: "bg-liquid",
				order: 10,
				fixed: true,
				render: (renderCtx) => <LiquidBackground renderCtx={renderCtx} state={state} />,
				renderExportBackground: (exportCtx) =>
					state.isVisible()
						? renderLiquidExportBackground(exportCtx, state.getSettings().color)
						: null,
			});

			const offBg = ctx.events.on<{ type: string }>("bg:set", ({ type }) => {
				if (type !== LIQUID_BG_TYPE) previousType = type;
				state.setVisible(type === LIQUID_BG_TYPE);
			});

			const api = createLiquidBgApi(ctx.store, ctx.events, state, () => previousType);
			const offService = liquidBgService.provide(ctx.services, api);

			// ── HUD: live settings ──
			const offSettings = ctx.hud.registerSettings({
				id: "bg-liquid:settings",
				label: "Liquid",
				fields: [
					{ name: "visible", label: "表示", type: "boolean" },
					{
						name: "mode",
						label: "押しのけるオブジェクト",
						type: "enum",
						options: [
							{ value: "marked", label: "指定したシェイプのみ" },
							{ value: "all", label: "すべてのシェイプ" },
						],
					},
					{ name: "viscosity", label: "粘度", type: "number", min: 0, max: 1, step: 0.05 },
					{ name: "flow", label: "流れ", type: "number", min: 0, max: 1, step: 0.05 },
					{ name: "color", label: "色", type: "color" },
				],
				get: (name) =>
					name === "visible"
						? state.isVisible()
						: state.getSettings()[name as keyof LiquidSettings],
				set: (name, value) => {
					if (name === "visible") {
						if (value) api.show();
						else api.hide();
						return;
					}
					state.setSettings({ [name]: value } as Partial<LiquidSettings>);
				},
				subscribe: state.subscribe,
			});

			// ── HUD: mark the selection as displacers ──
			const offAction = ctx.actions.register({
				id: "bg-liquid:toggle-displacer",
				label: "選択シェイプで液体を押しのける（切替）",
				group: "Background",
				run: () => {
					toggleLiquidDisplacer(ctx.store, ctx.store.getSelection());
				},
				isEnabled: () => ctx.store.getSelection().size > 0,
			});

			if (options.visible) api.show();

			return () => {
				offBg();
				offService();
				offSettings();
				offAction();
				ctx.layers.unregister("bg-liquid");
			};
		},
	};
}
