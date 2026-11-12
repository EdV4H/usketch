import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { type FreedrawConfigInput, parseFreedrawConfig } from "./config.js";
import {
	assertCustomPenId,
	clampPenSize,
	type FreedrawPenDefinition,
	getPenDefinition,
	registerPen,
} from "./custom-pens.js";
import { createDrawController } from "./draw-tool.js";
import { createFreedrawApi, freedrawService, listPens } from "./freedraw-service.js";
import { isKnownPen } from "./pen-meta.js";
import { createFreedrawSettingsStore } from "./settings-store.js";
import { createFreedrawShapeDefinition, type FreedrawHitTestMode } from "./shape.js";
import type { PenId } from "./types.js";
import { createPointerStore, FreedrawCursor } from "./ui/cursor-overlay.js";

const TOOL_ID = "freedraw-draw";

function FreedrawIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
			<title>Freedraw</title>
			<path
				d="M4 16 C6 10, 10 4, 16 6"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</svg>
	);
}

/** `createFreedrawPlugin` の 2 つ目の引数（JSON にできない設定）。 */
export interface FreedrawPluginOptions {
	/**
	 * 組み込みの 4 種に足すペン。setup で登録し、teardown で外す。ペンは shape の描画と
	 * 当たり判定に効くので、実行中に足し外しせず、ここで渡す。
	 */
	pens?: FreedrawPenDefinition[];
}

const BUILT_IN_SIZE_MAX = 64;

export function createFreedrawPlugin(
	configInput?: FreedrawConfigInput,
	options: FreedrawPluginOptions = {},
): UsketchPlugin {
	const config = parseFreedrawConfig(configInput);
	const pens = options.pens ?? [];
	// 組み込みの id と重なるペンは、何も登録しないうちに弾く。
	for (const def of pens) assertCustomPenId(def.id);
	const sizeMax = Math.max(BUILT_IN_SIZE_MAX, ...pens.map((d) => d.sizeRange?.max ?? 0));

	return {
		id: "usketch-plugin-shape-freedraw",
		name: "フリーハンド",

		setup(ctx: PluginContext) {
			// 設定の復元で保存済みのペンを確かめるため、ペンは設定ストアより先に登録する。
			const offPens = pens.map((def) => registerPen(def));
			const settings = createFreedrawSettingsStore(config);
			const offService = freedrawService.provide(ctx.services, createFreedrawApi(settings));
			const pointer = createPointerStore();
			let endpointSnap = config.endpointSnap;
			const draw = createDrawController(settings, pointer, { endpointSnap: () => endpointSnap });

			let hitMode: FreedrawHitTestMode = config.hitTest;
			ctx.shapes.register(
				"freedraw",
				createFreedrawShapeDefinition(() => hitMode),
			);

			ctx.tools.register(TOOL_ID, {
				icon: FreedrawIcon,
				cursor: config.cursorPreview ? "none" : "crosshair",
				shortcut: "p",
				order: 30,
				onActivate(toolCtx) {
					toolCtx.events.emit("snap:configure", { enabled: false });
				},
				onDeactivate(toolCtx) {
					draw.reset();
					toolCtx.events.emit("snap:configure", { enabled: true });
				},
				onPointerDown: draw.onPointerDown,
				onPointerMove: draw.onPointerMove,
				onPointerUp: draw.onPointerUp,
			});

			// ── 自前 UI レイヤー（Vim-first でツールバーが無くても動く） ──
			ctx.layers.register({
				id: "freedraw-cursor",
				order: 92,
				fixed: true,
				// World-anchored: follow the camera rotation (see Layer.worldOverlay).
				worldOverlay: true,
				interactable: false,
				render: (rc) => (
					<FreedrawCursor settings={settings} pointer={pointer} viewport={rc.viewport} />
				),
			});
			// freedraw の設定 palette は Control HUD の Action(freedraw:*)に統合したため撤去。
			// カーソル(描画フィードバック)は維持。

			// ── vim 連携 / 外部からの設定変更イベント ──
			const offPen = ctx.events.on<{ pen: PenId }>("freedraw:set-pen", ({ pen }) => {
				if (isKnownPen(pen)) settings.update({ pen, mode: "pen" });
			});
			const offColor = ctx.events.on<{ color: string }>("freedraw:set-color", ({ color }) => {
				const cur = settings.getSnapshot();
				const custom = cur.customColors.includes(color)
					? cur.customColors
					: [...cur.customColors, color];
				settings.update({ color, customColors: custom, mode: "pen" });
			});
			const offSize = ctx.events.on<{ size: number }>("freedraw:set-size", ({ size }) => {
				const cur = settings.getSnapshot();
				if (cur.mode === "eraser") settings.update({ eraserSize: size });
				else {
					const clamped = clampPenSize(getPenDefinition(cur.pen), size);
					settings.update({ sizes: { ...cur.sizes, [cur.pen]: clamped } });
				}
			});
			const offEndpointSnap = ctx.events.on<{ enabled: boolean }>(
				"freedraw:set-endpoint-snap",
				({ enabled }) => {
					if (typeof enabled === "boolean") endpointSnap = enabled;
				},
			);
			const offHitTest = ctx.events.on<{ mode: FreedrawHitTestMode }>(
				"freedraw:set-hit-test",
				({ mode }) => {
					if (mode === "stroke" || mode === "bounds") hitMode = mode;
				},
			);
			const offEraser = ctx.events.on("freedraw:toggle-eraser", () => {
				const cur = settings.getSnapshot();
				settings.update({ mode: cur.mode === "eraser" ? "pen" : "eraser" });
			});

			// ── 操作を Action として公開（Control HUD が自動でUI化。#HUD） ──
			const offActions = [
				ctx.actions.register({
					id: "freedraw:pen",
					label: "Pen",
					group: "Freedraw",
					params: [
						{
							name: "pen",
							type: "enum",
							default: "ballpoint",
							options: [
								{ value: "ballpoint", label: "Ballpoint" },
								{ value: "felt", label: "Felt" },
								{ value: "brush", label: "Brush" },
								{ value: "highlighter", label: "Highlighter" },
								// 外から足したペン（setup 時点の登録分）。
								...listPens()
									.filter((p) => !p.builtIn)
									.map((p) => ({ value: p.id, label: p.label })),
							],
						},
					],
					run: ({ pen }) => ctx.events.emit("freedraw:set-pen", { pen }),
				}),
				ctx.actions.register({
					id: "freedraw:color",
					label: "Color",
					group: "Freedraw",
					params: [{ name: "color", type: "color", default: "#1e1e1e" }],
					run: ({ color }) => ctx.events.emit("freedraw:set-color", { color }),
				}),
				ctx.actions.register({
					id: "freedraw:size",
					label: "Size",
					group: "Freedraw",
					// 足したペンの太さの範囲まで届くようにする（実際の値は set-size がペンごとに丸める）。
					params: [{ name: "size", type: "number", min: 1, max: sizeMax, step: 1, default: 4 }],
					run: ({ size }) => ctx.events.emit("freedraw:set-size", { size: Number(size) }),
				}),
				ctx.actions.register({
					id: "freedraw:eraser",
					label: "Eraser",
					group: "Freedraw",
					isActive: () => settings.getSnapshot().mode === "eraser",
					run: () => ctx.events.emit("freedraw:toggle-eraser", {}),
				}),
			];

			// Escape: 消しゴム中ならペンへ、そうでなければ既定ツール（Vim-first では vim）へ戻る。
			const onKeyDown = (e: KeyboardEvent) => {
				if (ctx.store.getActiveToolId() !== TOOL_ID || e.key !== "Escape") return;
				if (settings.getSnapshot().mode === "eraser") {
					settings.update({ mode: "pen" });
				} else {
					ctx.store.resetToDefaultTool();
				}
				e.preventDefault();
				e.stopImmediatePropagation();
			};
			if (typeof window !== "undefined") {
				window.addEventListener("keydown", onKeyDown, true);
			}

			return () => {
				offPen();
				offColor();
				offSize();
				offEraser();
				offHitTest();
				offEndpointSnap();
				for (const off of offActions) off();
				if (typeof window !== "undefined") {
					window.removeEventListener("keydown", onKeyDown, true);
				}
				ctx.layers.unregister("freedraw-cursor");
				offService();
				for (const off of offPens) off();
			};
		},
	};
}
