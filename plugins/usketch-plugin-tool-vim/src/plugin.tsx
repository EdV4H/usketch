import type { PluginContext, ToolContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { createActor, type SnapshotFrom } from "xstate";
import { parseVimConfig } from "./config/default-config.js";
import type { VimConfigInput } from "./config/schema.js";
import type { VimExtensions } from "./extensions.js";
import { translateKey } from "./keymap.js";
import type { VimMode } from "./machine/types.js";
import { vimMachine } from "./machine/vim-machine.js";
import { VimHelpOverlay } from "./ui/help-overlay.js";
import { VimOverlay } from "./ui/overlay.js";
import { VimStatusLine } from "./ui/status-line.js";
import { createVimUiStore, type VimSnapshot } from "./ui/vim-ui-store.js";
import { VimWhichKey } from "./ui/which-key.js";
import { screenCenterWorld } from "./viewport-utils.js";

const TOOL_ID = "vim";

function VimIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
			<title>Vim</title>
			<rect
				x="2.5"
				y="2.5"
				width="15"
				height="15"
				rx="2.5"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<path
				d="M6 6l4 8 4-8"
				stroke="currentColor"
				strokeWidth="1.7"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

type VimMachineSnapshot = SnapshotFrom<typeof vimMachine>;

/** machine の生スナップショットを UI 用のフラットな {@link VimSnapshot} に変換。 */
function deriveSnapshot(snap: VimMachineSnapshot, active: boolean): VimSnapshot {
	const value = snap.value;
	let mode: VimMode;
	let visualMulti = false;
	if (typeof value === "string") {
		mode = value as VimMode;
	} else {
		mode = "visual";
		visualMulti = (value as { visual?: string }).visual === "multi";
	}

	const ctx = snap.context;
	const candidate = ctx.candidates[ctx.candidateIndex];
	const ghost = candidate
		? {
				width: candidate.spec.width ?? 120,
				height: candidate.spec.height ?? 80,
				label: candidate.label,
			}
		: null;

	return {
		active,
		mode,
		visualMulti,
		cursor: ctx.cursor,
		count: ctx.count,
		inputBuffer: ctx.inputBuffer,
		candidates: ctx.candidates.map((c) => ({ alias: c.alias, label: c.label })),
		candidateIndex: ctx.candidateIndex,
		ghost,
		commandBuffer: ctx.commandBuffer,
		whichKeyVisible: ctx.whichKeyVisible,
		helpVisible: ctx.helpVisible,
		hopTargets: ctx.hopLabels.map((t) => ({
			label: t.label,
			cx: t.cx,
			cy: t.cy,
			matched: t.label.startsWith(ctx.hopBuffer),
		})),
		hopBuffer: ctx.hopBuffer,
		lastMessage: ctx.lastMessage,
		registerCount: ctx.register.length,
	};
}

export function createVimToolPlugin(
	configInput?: VimConfigInput,
	extensions: VimExtensions = {},
): UsketchPlugin {
	const config = parseVimConfig(configInput);

	return {
		id: "usketch-plugin-tool-vim",
		name: "Vim",

		setup(ctx: PluginContext) {
			const deps: ToolContext = {
				store: ctx.store,
				shapes: ctx.shapes,
				commands: ctx.commands,
				events: ctx.events,
			};

			const uiStore = createVimUiStore();
			const actor = createActor(vimMachine, {
				input: { config, deps, extensions, initialCursor: screenCenterWorld(ctx.store) },
			});

			let active = ctx.store.getActiveToolId() === TOOL_ID;
			// 多キープレフィックス（gg / zz / ma / `a）の持ち越しバッファ。
			let pending = "";

			const pushSnapshot = () => uiStore.set(deriveSnapshot(actor.getSnapshot(), active));

			actor.subscribe(() => pushSnapshot());
			actor.start();
			pushSnapshot();

			// ── キーボード割込み（capture フェーズで先取り） ──
			const onKeyDown = (e: KeyboardEvent) => {
				if (ctx.store.getActiveToolId() !== TOOL_ID) return;
				// フォーカス中の入力要素（テキスト編集 contentEditable / フォーム）では
				// キーを奪わず素通しする（native のテキスト入力を妨げない）。
				const target = e.target as HTMLElement | null;
				const tag = target?.tagName;
				if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
					return;
				}
				const mode = uiStore.getSnapshot().mode;
				const { event, pending: nextPending } = translateKey(
					e,
					mode,
					config,
					pending,
					extensions.bindings,
				);
				pending = nextPending;
				// vim がアクティブな間は既存のアプリ側ショートカットに渡さない。
				e.preventDefault();
				e.stopImmediatePropagation();
				if (event) actor.send(event);
			};
			// SSR/テスト等 window 不在の環境ではリスナを張らない（viewport-utils と整合）。
			if (typeof window !== "undefined") {
				window.addEventListener("keydown", onKeyDown, true);
			}

			// ── ツール登録 ──
			ctx.tools.register(TOOL_ID, {
				icon: VimIcon,
				cursor: "none",
				order: 99,
				onActivate() {
					active = true;
					pending = "";
					actor.send({ type: "RESET", cursor: screenCenterWorld(ctx.store) });
					pushSnapshot();
				},
				onDeactivate() {
					active = false;
					pending = "";
					pushSnapshot();
				},
			});

			// 他経路（:q, :tool 等）でツールが変わったときも active を同期。
			const unsubMutation = ctx.store.onMutation((evt) => {
				if (evt.type === "tool:changed") {
					active = ctx.store.getActiveToolId() === TOOL_ID;
					pushSnapshot();
				}
			});

			// ── UI レイヤー登録（プラグインが自前で chrome を描画） ──
			ctx.layers.register({
				id: "vim-overlay",
				order: 85,
				fixed: true,
				interactable: false,
				render: (rc) => <VimOverlay store={uiStore} viewport={rc.viewport} />,
			});
			ctx.layers.register({
				id: "vim-status-line",
				order: 130,
				fixed: true,
				interactable: false,
				render: () => (config.showStatusLine ? <VimStatusLine store={uiStore} /> : null),
			});
			ctx.layers.register({
				id: "vim-which-key",
				order: 131,
				fixed: true,
				interactable: false,
				render: () => (config.showWhichKey ? <VimWhichKey store={uiStore} /> : null),
			});
			ctx.layers.register({
				id: "vim-help",
				order: 132,
				fixed: true,
				interactable: false,
				render: () => <VimHelpOverlay store={uiStore} />,
			});

			// ── teardown ──
			return () => {
				if (typeof window !== "undefined") {
					window.removeEventListener("keydown", onKeyDown, true);
				}
				unsubMutation();
				actor.stop();
				ctx.layers.unregister("vim-overlay");
				ctx.layers.unregister("vim-status-line");
				ctx.layers.unregister("vim-which-key");
				ctx.layers.unregister("vim-help");
			};
		},
	};
}
