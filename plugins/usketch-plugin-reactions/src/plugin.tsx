import {
	type CanvasPointerEvent,
	generateId,
	type PluginContext,
	type ToolContext,
	type TransientObject,
	type UsketchPlugin,
} from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";

const REACTION_TTL = 3000;
const APPLAUSE_TTL = 5000;

const QUICK_EMOJIS = ["👍", "❤️", "🎉", "🔥", "👏", "😂", "🤔", "👀"];

function ReactionEffect({ obj }: { obj: TransientObject }) {
	const emoji = (obj.data.emoji as string) || "👍";
	const isApplause = obj.type === "applause";
	const ttl = isApplause ? APPLAUSE_TTL : REACTION_TTL;

	return (
		<div
			style={{
				position: "absolute",
				left: -16,
				top: -16,
				fontSize: isApplause ? 32 : 24,
				animation: `usketch-reaction-float ${ttl}ms ease-out forwards`,
				pointerEvents: "none",
				userSelect: "none",
			}}
		>
			{emoji}
		</div>
	);
}

function ReactionIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<title>Reaction</title>
			<circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
			<circle cx="7" cy="8" r="1" fill="currentColor" />
			<circle cx="13" cy="8" r="1" fill="currentColor" />
			<path d="M6.5 12.5Q10 15 13.5 12.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
		</svg>
	);
}

let styleInjected = false;
function injectStyle() {
	if (styleInjected) return;
	styleInjected = true;
	const style = document.createElement("style");
	style.textContent = `
		@keyframes usketch-reaction-float {
			0% { transform: scale(0.5) translateY(0); opacity: 1; }
			50% { transform: scale(1.2) translateY(-20px); opacity: 1; }
			100% { transform: scale(1) translateY(-40px); opacity: 0; }
		}
	`;
	document.head.appendChild(style);
}

function createPlugin(wsProvider?: WsProviderHandle): UsketchPlugin {
	return {
		id: "usketch-plugin-reactions",
		name: "リアクション",

		setup(ctx: PluginContext) {
			let selectedEmoji = "👍";

			injectStyle();

			ctx.transient.registerType("reaction", {
				render: (obj) => <ReactionEffect obj={obj} />,
			});
			ctx.transient.registerType("applause", {
				render: (obj) => <ReactionEffect obj={obj} />,
			});

			let unsubBroadcast: (() => void) | undefined;
			if (wsProvider) {
				unsubBroadcast = wsProvider.onBroadcast((msg) => {
					if (msg.kind !== "reaction" && msg.kind !== "applause") return;

					const id = msg.id;
					const position = msg.position as Record<string, unknown> | undefined;
					if (
						typeof id !== "string" ||
						!position ||
						typeof position.x !== "number" ||
						typeof position.y !== "number"
					) {
						return;
					}

					ctx.transient.emit({
						id,
						type: msg.kind as string,
						sourceUserId: typeof msg.sourceUserId === "string" ? msg.sourceUserId : "remote",
						position: { x: position.x, y: position.y },
						data: { emoji: typeof msg.emoji === "string" ? msg.emoji : "👍" },
						ttl: msg.kind === "applause" ? APPLAUSE_TTL : REACTION_TTL,
						createdAt: Date.now(),
					});
				});
			}

			function emitReaction(
				_toolCtx: ToolContext,
				event: CanvasPointerEvent,
				type: "reaction" | "applause" = "reaction",
			) {
				const id = generateId();
				const ttl = type === "applause" ? APPLAUSE_TTL : REACTION_TTL;

				ctx.transient.emit({
					id,
					type,
					sourceUserId: "local",
					position: event.worldPoint,
					data: { emoji: selectedEmoji },
					ttl,
					createdAt: Date.now(),
				});

				wsProvider?.broadcast({
					kind: type,
					id,
					sourceUserId: "local",
					position: event.worldPoint,
					emoji: selectedEmoji,
				});
			}

			ctx.tools.register("reaction", {
				icon: ReactionIcon,
				cursor: "pointer",
				shortcut: "e",
				order: 55,
				onPointerDown: (toolCtx, event) => emitReaction(toolCtx, event, "reaction"),
			});

			// 絵文字切替ショートカット: 1-8で選択
			const unsubShortcuts: (() => void)[] = [];
			for (let i = 0; i < QUICK_EMOJIS.length; i++) {
				const unsub = ctx.shortcuts.register(`${i + 1}`, () => {
					if (ctx.store.getActiveToolId() === "reaction") {
						selectedEmoji = QUICK_EMOJIS[i];
					}
				});
				unsubShortcuts.push(unsub);
			}

			// 絵文字選択を Control HUD の action として露出（数字キーの代替）。
			const unsubActions = QUICK_EMOJIS.map((emoji, i) =>
				ctx.actions.register({
					id: `reaction:emoji:${i}`,
					group: "リアクション",
					label: `絵文字 ${emoji}`,
					order: i,
					isActive: () => selectedEmoji === emoji,
					run: () => {
						selectedEmoji = emoji;
					},
				}),
			);

			return () => {
				unsubBroadcast?.();
				for (const unsub of unsubShortcuts) unsub();
				for (const unsub of unsubActions) unsub();
			};
		},
	};
}

/** WsProvider付きファクトリ（リアルタイム同期対応） */
export function createReactionsPlugin(wsProvider?: WsProviderHandle): UsketchPlugin {
	return createPlugin(wsProvider);
}
