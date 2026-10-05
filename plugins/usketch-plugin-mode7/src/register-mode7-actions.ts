// The 4-path action wiring (event bus + action registry/HUD + optional keyboard),
// same convention as window-system. Each operation is a plain call on the service.
//
// Shortcuts are OPT-IN with NO defaults: the shared registry matches on `event.key`,
// which macOS Option-composes for letters and Shift-transforms for digits, so any
// built-in letter/digit default would silently fail on some layout. Every action is
// reachable via the HUD Controls + events; the host binds keys through `shortcuts`.
import type { PluginContext } from "@edv4h/usketch-shared";
import type { Mode7Api } from "./mode7-service.js";

export type Mode7ActionKey =
	| "toggle"
	| "pitch-up"
	| "pitch-down"
	| "yaw-left"
	| "yaw-right"
	| "fov-narrow"
	| "fov-wide"
	| "reset"
	| "capture-frame";

/** Host shortcut overrides: a combo string binds the action; omitting a key leaves
 *  it unbound (there are no built-in defaults). `null` is also treated as unbound. */
export type Mode7Shortcuts = Partial<Record<Mode7ActionKey, string | null>>;

const PITCH_STEP = 5;
const YAW_STEP = 10;
const FOV_STEP = 100;

interface ActionDesc {
	key: Mode7ActionKey;
	label: string;
	order: number;
	run: () => void;
	isActive?: () => boolean;
	isEnabled?: () => boolean;
}

export function registerMode7Actions(
	ctx: PluginContext,
	api: Mode7Api,
	shortcuts: Mode7Shortcuts = {},
): () => void {
	const GROUP = "Mode 7 (3D)";
	const on = () => api.isActive();

	const actions: ActionDesc[] = [
		{
			key: "toggle",
			label: "3Dビュー切替",
			order: 0,
			run: () => api.toggle(),
			isActive: on,
		},
		{
			key: "pitch-up",
			label: "傾きを強める",
			order: 10,
			run: () => api.adjust({ pitch: PITCH_STEP }),
			isEnabled: on,
		},
		{
			key: "pitch-down",
			label: "傾きを弱める",
			order: 11,
			run: () => api.adjust({ pitch: -PITCH_STEP }),
			isEnabled: on,
		},
		{
			key: "yaw-left",
			label: "左へ旋回",
			order: 20,
			run: () => api.adjust({ yaw: -YAW_STEP }),
			isEnabled: on,
		},
		{
			key: "yaw-right",
			label: "右へ旋回",
			order: 21,
			run: () => api.adjust({ yaw: YAW_STEP }),
			isEnabled: on,
		},
		{
			key: "fov-narrow",
			label: "遠近を強める",
			order: 30,
			run: () => api.adjust({ fov: -FOV_STEP }),
			isEnabled: on,
		},
		{
			key: "fov-wide",
			label: "遠近を弱める",
			order: 31,
			run: () => api.adjust({ fov: FOV_STEP }),
			isEnabled: on,
		},
		{ key: "reset", label: "カメラをリセット", order: 40, run: () => api.reset(), isEnabled: on },
		{
			key: "capture-frame",
			label: "取り込み範囲の表示切替",
			order: 50,
			run: () => api.toggleCaptureFrame(),
			isActive: () => api.isCaptureFrameVisible(),
		},
	];

	const teardowns: (() => void)[] = [];

	for (const a of actions) {
		teardowns.push(ctx.events.on(`mode7:${a.key}`, () => a.run()));
		teardowns.push(
			ctx.actions.register({
				id: `usketch-plugin-mode7:${a.key}`,
				label: a.label,
				group: GROUP,
				order: a.order,
				run: () => a.run(),
				...(a.isActive ? { isActive: a.isActive } : {}),
				...(a.isEnabled ? { isEnabled: a.isEnabled } : {}),
			}),
		);
		const combo = shortcuts[a.key];
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
