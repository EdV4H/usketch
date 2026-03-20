import type {
	CanvasPointerEvent,
	PluginContext,
	ToolContext,
	TransientObject,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";

const BUBBLE_TTL = 10000;

function ChatBubble({ obj }: { obj: TransientObject }) {
	const text = (obj.data.text as string) || "";
	const name = (obj.data.name as string) || "";
	const color = (obj.data.color as string) || "#333";

	return (
		<div
			style={{
				position: "absolute",
				left: -4,
				top: -40,
				transform: "translateX(-50%)",
				pointerEvents: "none",
			}}
		>
			<div
				style={{
					background: "#fff",
					border: `2px solid ${color}`,
					borderRadius: 12,
					padding: "6px 10px",
					fontSize: 13,
					fontFamily: "system-ui, sans-serif",
					color: "#333",
					maxWidth: 200,
					wordBreak: "break-word",
					boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
					whiteSpace: "pre-wrap",
				}}
			>
				{text}
			</div>
			{name && (
				<div
					style={{
						fontSize: 10,
						color: "#999",
						textAlign: "center",
						marginTop: 2,
					}}
				>
					{name}
				</div>
			)}
		</div>
	);
}

function ChatIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<title>Chat</title>
			<path
				d="M4 4h12a2 2 0 012 2v6a2 2 0 01-2 2H8l-4 3v-3a2 2 0 01-2-2V6a2 2 0 012-2z"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<line x1="7" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1" opacity="0.5" />
			<line x1="7" y1="11" x2="11" y2="11" stroke="currentColor" strokeWidth="1" opacity="0.5" />
		</svg>
	);
}

let styleInjected = false;
function injectStyle() {
	if (styleInjected) return;
	styleInjected = true;
	const style = document.createElement("style");
	style.textContent = `
		@keyframes usketch-chat-fade {
			0% { opacity: 1; }
			80% { opacity: 1; }
			100% { opacity: 0; }
		}
	`;
	document.head.appendChild(style);
}

/** チャット入力を管理するグローバル状態 */
const chatInput = {
	active: false,
	text: "",
	worldPoint: { x: 0, y: 0 },
	onSubmit: null as ((text: string, point: { x: number; y: number }) => void) | null,
	onCancel: null as (() => void) | null,
};

function ChatInputOverlay() {
	if (!chatInput.active) return null;

	return (
		<div
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 200,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			}}
			onPointerDown={(e) => {
				e.stopPropagation();
				chatInput.onCancel?.();
			}}
		>
			<div
				onPointerDown={(e) => e.stopPropagation()}
				style={{
					background: "#fff",
					borderRadius: 12,
					padding: 16,
					boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
					minWidth: 280,
				}}
			>
				<input
					// biome-ignore lint/a11y/noAutofocus: chat input needs immediate focus
					autoFocus
					type="text"
					placeholder="Type a message..."
					maxLength={200}
					style={{
						width: "100%",
						padding: "8px 12px",
						fontSize: 14,
						border: "1px solid #ddd",
						borderRadius: 8,
						outline: "none",
						fontFamily: "system-ui, sans-serif",
						boxSizing: "border-box",
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter" && e.currentTarget.value.trim()) {
							chatInput.onSubmit?.(e.currentTarget.value.trim(), chatInput.worldPoint);
							chatInput.active = false;
						} else if (e.key === "Escape") {
							chatInput.onCancel?.();
						}
					}}
				/>
				<div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
					Enter to send, Esc to cancel
				</div>
			</div>
		</div>
	);
}

function createPlugin(wsProvider?: WsProviderHandle): UsketchPlugin {
	let cleanup: (() => void) | undefined;

	return {
		id: "usketch-plugin-spatial-chat",
		name: "空間チャット",

		setup(ctx: PluginContext) {
			injectStyle();

			ctx.transient.registerType("chat-bubble", {
				render: (obj) => <ChatBubble obj={obj} />,
			});

			let bubbleCounter = 0;

			let unsubBroadcast: (() => void) | undefined;
			if (wsProvider) {
				unsubBroadcast = wsProvider.onBroadcast((msg) => {
					if (msg.kind !== "chat-bubble") return;

					const position = msg.position as Record<string, unknown> | undefined;
					if (
						typeof msg.id !== "string" ||
						!position ||
						typeof position.x !== "number" ||
						typeof position.y !== "number" ||
						typeof msg.text !== "string"
					) {
						return;
					}

					ctx.transient.emit({
						id: msg.id as string,
						type: "chat-bubble",
						sourceUserId: typeof msg.sourceUserId === "string" ? msg.sourceUserId : "remote",
						position: { x: position.x, y: position.y },
						data: {
							text: msg.text,
							name: typeof msg.name === "string" ? msg.name : "",
							color: typeof msg.color === "string" ? msg.color : "#333",
						},
						ttl: BUBBLE_TTL,
						createdAt: Date.now(),
					});
				});
			}

			function getUserInfo(): { name: string; color: string } {
				if (!wsProvider) return { name: "", color: "#333" };
				const local = wsProvider.awareness.getLocalState();
				const user = local?.user as { name?: string; color?: string } | undefined;
				return { name: user?.name ?? "", color: user?.color ?? "#333" };
			}

			function emitBubble(text: string, point: { x: number; y: number }) {
				const id = `chat-${Date.now()}-${bubbleCounter++}`;
				const { name, color } = getUserInfo();

				ctx.transient.emit({
					id,
					type: "chat-bubble",
					sourceUserId: "local",
					position: point,
					data: { text, name, color },
					ttl: BUBBLE_TTL,
					createdAt: Date.now(),
				});

				wsProvider?.broadcast({
					kind: "chat-bubble",
					id,
					sourceUserId: "local",
					position: point,
					text,
					name,
					color,
				});
			}

			// チャット入力UIをfixedレイヤーとして登録
			ctx.layers.register({
				id: "spatial-chat-input",
				order: 200,
				fixed: true,
				render: () => <ChatInputOverlay />,
			});

			chatInput.onSubmit = emitBubble;
			chatInput.onCancel = () => {
				chatInput.active = false;
			};

			function onPointerDown(_toolCtx: ToolContext, event: CanvasPointerEvent) {
				chatInput.worldPoint = event.worldPoint;
				chatInput.active = true;
			}

			ctx.tools.register("spatial-chat", {
				icon: ChatIcon,
				cursor: "text",
				shortcut: "c",
				order: 65,
				onPointerDown,
			});

			cleanup = () => {
				unsubBroadcast?.();
				ctx.layers.unregister("spatial-chat-input");
				chatInput.active = false;
				chatInput.onSubmit = null;
				chatInput.onCancel = null;
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}

export function createSpatialChatPlugin(wsProvider: WsProviderHandle): UsketchPlugin {
	return createPlugin(wsProvider);
}

export const spatialChatPlugin: UsketchPlugin = createPlugin();
