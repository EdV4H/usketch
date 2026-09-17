// The 4-path action wiring (same convention as snap/export): each window
// operation is a plain method on the service; here we surface each one on THREE
// input paths — the event bus (`window:<action>`, emittable by anyone), the action
// registry (auto-listed in the Debug/Control HUD, no bespoke UI), and the keyboard
// (an opt-in, host-configurable shortcut). One list drives all three so they never
// drift.
//
// Shortcut defaults: only the ARROW-based focus/move are bound by default because
// the shared shortcut registry matches on `event.key`, which macOS Option-composes
// for LETTER keys (Alt+T → "†"), so an "Alt+<letter>" default would silently fail
// on macOS. Arrow keys are unaffected, so Alt+Arrows / Alt+Shift+Arrows work
// everywhere. Every other action is reachable via the HUD + events, and the host
// can bind ANY action to a combo (or disable a default) through the `shortcuts`
// option — a robust combo for a given OS/layout is the host's call.
import type { PluginContext } from "@edv4h/usketch-shared";
import type { FocusDir } from "./tile-tree.js";
import type { WindowSystemApi } from "./window-service.js";

/** The stable ids of the window system's actions (event/action/shortcut keys). */
export type WindowActionKey =
	| "enable"
	| "disable"
	| "toggle-mode"
	| "set-mode-free"
	| "set-mode-tile"
	| "toggle-lock"
	| "retile"
	| "focus-left"
	| "focus-right"
	| "focus-up"
	| "focus-down"
	| "move-left"
	| "move-right"
	| "move-up"
	| "move-down"
	| "split-h"
	| "split-v"
	| "resize-grow"
	| "resize-shrink"
	| "fullscreen-toggle";

/**
 * Host shortcut overrides: a combo string binds the action (replacing any
 * default), `null` disables it, and omitting a key keeps the built-in default.
 */
export type WindowShortcuts = Partial<Record<WindowActionKey, string | null>>;

/** Only the cross-platform-safe arrow combos are bound by default. */
const DEFAULT_SHORTCUTS: Partial<Record<WindowActionKey, string>> = {
	"focus-left": "Alt+ArrowLeft",
	"focus-right": "Alt+ArrowRight",
	"focus-up": "Alt+ArrowUp",
	"focus-down": "Alt+ArrowDown",
	"move-left": "Alt+Shift+ArrowLeft",
	"move-right": "Alt+Shift+ArrowRight",
	"move-up": "Alt+Shift+ArrowUp",
	"move-down": "Alt+Shift+ArrowDown",
};

interface ActionDesc {
	key: WindowActionKey;
	label: string;
	order: number;
	run: () => void;
	isActive?: () => boolean;
	isEnabled?: () => boolean;
}

/** Register every action on all three input paths. Returns a teardown. */
export function registerWindowActions(
	ctx: PluginContext,
	api: WindowSystemApi,
	shortcuts: WindowShortcuts = {},
): () => void {
	const GROUP = "ウィンドウ";
	const board = () => api.isWindowBoard();
	const tiling = () => api.isWindowBoard() && api.getMode() === "tile";
	const focus = (dir: FocusDir) => () => api.focus(dir);
	const move = (dir: FocusDir) => () => api.move(dir);

	const actions: ActionDesc[] = [
		{
			key: "enable",
			label: "ウィンドウ化",
			order: 0,
			run: () => api.enable(),
			isEnabled: () => !board(),
			isActive: board,
		},
		{
			key: "disable",
			label: "ウィンドウ解除",
			order: 1,
			run: () => api.disable(),
			isEnabled: board,
		},
		{
			key: "toggle-mode",
			label: "モード切替(自由/タイル)",
			order: 2,
			run: () => api.toggleMode(),
			isActive: () => api.getMode() === "tile",
			isEnabled: board,
		},
		{
			key: "set-mode-free",
			label: "自由配置",
			order: 3,
			run: () => api.setMode("free"),
			isEnabled: board,
			isActive: () => api.getMode() === "free",
		},
		{
			key: "set-mode-tile",
			label: "タイル配置",
			order: 4,
			run: () => api.setMode("tile"),
			isEnabled: board,
			isActive: () => api.getMode() === "tile",
		},
		{
			key: "toggle-lock",
			label: "画角固定",
			order: 5,
			run: () => api.toggleLock(),
			isActive: () => api.getLock(),
			isEnabled: board,
		},
		{ key: "retile", label: "再タイル", order: 6, run: () => api.retile(), isEnabled: tiling },
		{ key: "focus-left", label: "フォーカス←", order: 10, run: focus("left"), isEnabled: tiling },
		{ key: "focus-right", label: "フォーカス→", order: 11, run: focus("right"), isEnabled: tiling },
		{ key: "focus-up", label: "フォーカス↑", order: 12, run: focus("up"), isEnabled: tiling },
		{ key: "focus-down", label: "フォーカス↓", order: 13, run: focus("down"), isEnabled: tiling },
		{ key: "move-left", label: "移動←", order: 20, run: move("left"), isEnabled: tiling },
		{ key: "move-right", label: "移動→", order: 21, run: move("right"), isEnabled: tiling },
		{ key: "move-up", label: "移動↑", order: 22, run: move("up"), isEnabled: tiling },
		{ key: "move-down", label: "移動↓", order: 23, run: move("down"), isEnabled: tiling },
		{ key: "split-h", label: "水平分割", order: 30, run: () => api.splitH(), isEnabled: tiling },
		{ key: "split-v", label: "垂直分割", order: 31, run: () => api.splitV(), isEnabled: tiling },
		{ key: "resize-grow", label: "拡大", order: 40, run: () => api.resize(1), isEnabled: tiling },
		{
			key: "resize-shrink",
			label: "縮小",
			order: 41,
			run: () => api.resize(-1),
			isEnabled: tiling,
		},
		{
			key: "fullscreen-toggle",
			label: "全画面切替",
			order: 42,
			run: () => api.toggleFullscreen(),
			isEnabled: tiling,
			isActive: () => {
				const f = api.getFocused();
				return f != null && api.getMode() === "tile";
			},
		},
	];

	const teardowns: (() => void)[] = [];

	for (const a of actions) {
		// Path 1 — event bus: anyone can `emit("window:<key>")` to invoke it.
		teardowns.push(ctx.events.on(`window:${a.key}`, () => a.run()));
		// Path 2 — action registry: auto-surfaced in the Debug/Control HUD.
		teardowns.push(
			ctx.actions.register({
				id: `usketch-plugin-window-system:${a.key}`,
				label: a.label,
				group: GROUP,
				order: a.order,
				run: () => a.run(),
				...(a.isActive ? { isActive: a.isActive } : {}),
				...(a.isEnabled ? { isEnabled: a.isEnabled } : {}),
			}),
		);
		// Path 3 — keyboard: default (arrows) unless overridden; `null` disables.
		const override = shortcuts[a.key];
		const combo = override === undefined ? DEFAULT_SHORTCUTS[a.key] : override;
		if (combo) {
			teardowns.push(
				ctx.shortcuts.register(combo, () => a.run(), { label: a.label, category: GROUP }),
			);
		}
	}

	return () => {
		for (const t of teardowns) t();
	};
}
