import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import type { SmartActionRequestEvent, SmartActionType } from "./types.js";

export interface AiActionsOptions {
	boardId: string;
}

/**
 * 選択に追従するフローティング ActionBar（✨ Tidy / 🏷 Label / ✍ Recognize /
 * 💬 Comment / ⌨ Ask AI）は撤去し、すべて Control HUD の Action として提供する。
 * ホストアプリに専用の追従 UI を足さなくても HUD だけで実行できる。
 *
 * 実処理は別プラグインが担当する（`ai:smart-action`→ai-agent、`ai:recognize`→
 * ai-recognize、`comments:start-thread`→comments）。ここは trigger のみ。
 */
export function createAiActionsPlugin(options: AiActionsOptions): UsketchPlugin {
	return {
		id: "usketch-plugin-ai-actions",
		name: "AI Smart Actions",

		setup(ctx: PluginContext) {
			const selectionIds = (): string[] => Array.from(ctx.store.getSelection());

			const emitSmartAction = (
				action: SmartActionType,
				extra?: Partial<SmartActionRequestEvent>,
			): void => {
				ctx.events.emit("ai:smart-action", {
					action,
					selectedShapeIds: selectionIds(),
					boardId: options.boardId,
					...extra,
				} satisfies SmartActionRequestEvent);
			};

			// 選択が空 / connector のみ のときは対象外（旧 ActionBar の非表示条件を踏襲。
			// connector は専用の直接操作ハンドルを持つため）。
			const hasActionableSelection = (): boolean => {
				const sel = ctx.store.getSelection();
				if (sel.size === 0) return false;
				for (const id of sel) {
					const s = ctx.store.getShape(id);
					if (s && s.type !== "connector") return true;
				}
				return false;
			};

			// Recognize は freedraw / image のみを選択しているとき。
			const canRecognize = (): boolean => {
				const sel = ctx.store.getSelection();
				if (sel.size === 0) return false;
				for (const id of sel) {
					const s = ctx.store.getShape(id);
					if (!s || (s.type !== "freedraw" && s.type !== "image")) return false;
				}
				return true;
			};

			const offActions = [
				ctx.actions.register({
					id: "ai:tidy",
					label: "✨ Tidy",
					group: "AI",
					isEnabled: hasActionableSelection,
					run: () => emitSmartAction("tidy"),
				}),
				ctx.actions.register({
					id: "ai:label",
					label: "🏷 Label",
					group: "AI",
					isEnabled: hasActionableSelection,
					run: () => emitSmartAction("label"),
				}),
				ctx.actions.register({
					id: "ai:recognize",
					label: "✍ Recognize",
					group: "AI",
					isEnabled: canRecognize,
					run: () => ctx.events.emit("ai:recognize", {}),
				}),
				ctx.actions.register({
					id: "ai:ask",
					label: "⌨ Ask AI",
					group: "AI",
					isEnabled: hasActionableSelection,
					params: [{ name: "prompt", type: "string" }],
					run: (args) => {
						const prompt = typeof args.prompt === "string" ? args.prompt.trim() : "";
						if (!prompt) return;
						emitSmartAction("custom", { customPrompt: prompt });
					},
				}),
				ctx.actions.register({
					id: "comments:start-thread",
					label: "💬 Comment",
					group: "Collab",
					isEnabled: hasActionableSelection,
					run: () =>
						ctx.events.emit("comments:start-thread", {
							selectedShapeIds: selectionIds(),
						}),
				}),
			];

			return () => {
				for (const off of offActions) off();
			};
		},
	};
}
