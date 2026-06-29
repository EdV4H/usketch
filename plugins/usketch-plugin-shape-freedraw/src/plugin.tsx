import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { type FreedrawConfigInput, parseFreedrawConfig } from "./config.js";
import { createDrawController } from "./draw-tool.js";
import { PEN_META } from "./pen-meta.js";
import { createFreedrawSettingsStore } from "./settings-store.js";
import { freedrawShapeDefinition } from "./shape.js";
import type { PenKind } from "./types.js";
import { createPointerStore, FreedrawCursor } from "./ui/cursor-overlay.js";
import { type BoolStore, FreedrawPalette } from "./ui/palette.js";

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

function createBoolStore(initial: boolean) {
	let value = initial;
	const listeners = new Set<() => void>();
	const store: BoolStore & { set(v: boolean): void } = {
		getSnapshot: () => value,
		subscribe(l) {
			listeners.add(l);
			return () => listeners.delete(l);
		},
		set(v) {
			value = v;
			for (const l of listeners) l();
		},
	};
	return store;
}

export function createFreedrawPlugin(configInput?: FreedrawConfigInput): UsketchPlugin {
	const config = parseFreedrawConfig(configInput);

	return {
		id: "usketch-plugin-shape-freedraw",
		name: "フリーハンド",

		setup(ctx: PluginContext) {
			const settings = createFreedrawSettingsStore(config);
			const pointer = createPointerStore();
			const active = createBoolStore(ctx.store.getActiveToolId() === TOOL_ID);
			const draw = createDrawController(settings, pointer);

			ctx.shapes.register("freedraw", freedrawShapeDefinition);

			ctx.tools.register(TOOL_ID, {
				icon: FreedrawIcon,
				cursor: config.cursorPreview ? "none" : "crosshair",
				shortcut: "p",
				order: 30,
				onActivate(toolCtx) {
					active.set(true);
					toolCtx.events.emit("snap:configure", { enabled: false });
				},
				onDeactivate(toolCtx) {
					active.set(false);
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
				interactable: false,
				render: (rc) => (
					<FreedrawCursor settings={settings} pointer={pointer} viewport={rc.viewport} />
				),
			});
			ctx.layers.register({
				id: "freedraw-palette",
				order: 126,
				fixed: true,
				interactable: true,
				render: () => <FreedrawPalette settings={settings} active={active} />,
			});

			// ── vim 連携 / 外部からの設定変更イベント ──
			const offPen = ctx.events.on<{ pen: PenKind }>("freedraw:set-pen", ({ pen }) => {
				if (PEN_META[pen]) settings.update({ pen, mode: "pen" });
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
				else settings.update({ sizes: { ...cur.sizes, [cur.pen]: size } });
			});
			const offEraser = ctx.events.on("freedraw:toggle-eraser", () => {
				const cur = settings.getSnapshot();
				settings.update({ mode: cur.mode === "eraser" ? "pen" : "eraser" });
			});

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
				if (typeof window !== "undefined") {
					window.removeEventListener("keydown", onKeyDown, true);
				}
				ctx.layers.unregister("freedraw-cursor");
				ctx.layers.unregister("freedraw-palette");
			};
		},
	};
}
