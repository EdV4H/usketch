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
				<div style={{ fontSize: 10, color: "#999", textAlign: "center", marginTop: 2 }}>{name}</div>
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

/**
 * チャット入力ダイアログをDOMで直接管理。
 * Reactのレンダーサイクルに依存せず即座に表示/非表示を切り替える。
 */
function createChatInputDialog() {
	let onSubmit: ((text: string, point: { x: number; y: number }) => void) | null = null;
	let worldPoint = { x: 0, y: 0 };

	// ルートコンテナ
	const overlay = document.createElement("div");
	Object.assign(overlay.style, {
		position: "fixed",
		inset: "0",
		zIndex: "200",
		display: "none",
	});

	// 背景クリックでキャンセル
	overlay.addEventListener("pointerdown", (e) => {
		if (e.target === overlay) {
			hide();
		}
	});

	const dialog = document.createElement("div");
	Object.assign(dialog.style, {
		position: "absolute",
		background: "#fff",
		borderRadius: "12px",
		padding: "16px",
		boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
		minWidth: "240px",
	});
	dialog.addEventListener("pointerdown", (e) => e.stopPropagation());

	const input = document.createElement("input");
	input.type = "text";
	input.placeholder = "Type a message...";
	input.maxLength = 200;
	Object.assign(input.style, {
		width: "100%",
		padding: "8px 12px",
		fontSize: "14px",
		border: "1px solid #ddd",
		borderRadius: "8px",
		outline: "none",
		fontFamily: "system-ui, sans-serif",
		boxSizing: "border-box",
	});

	input.addEventListener("keydown", (e) => {
		e.stopPropagation();
		if (e.key === "Enter" && input.value.trim()) {
			onSubmit?.(input.value.trim(), worldPoint);
			hide();
		} else if (e.key === "Escape") {
			hide();
		}
	});

	const hint = document.createElement("div");
	Object.assign(hint.style, { fontSize: "11px", color: "#999", marginTop: "4px" });
	hint.textContent = "Enter to send, Esc to cancel";

	dialog.appendChild(input);
	dialog.appendChild(hint);
	overlay.appendChild(dialog);
	document.body.appendChild(overlay);

	function show(point: { x: number; y: number }, screenX: number, screenY: number) {
		worldPoint = point;
		input.value = "";
		// 画面端からはみ出さないよう位置を調整
		const pad = 8;
		const left = Math.min(screenX, window.innerWidth - 260 - pad);
		const top = Math.min(screenY + 12, window.innerHeight - 80 - pad);
		dialog.style.left = `${Math.max(pad, left)}px`;
		dialog.style.top = `${Math.max(pad, top)}px`;
		overlay.style.display = "block";
		requestAnimationFrame(() => input.focus());
	}

	function hide() {
		overlay.style.display = "none";
	}

	function destroy() {
		overlay.remove();
	}

	function setOnSubmit(fn: (text: string, point: { x: number; y: number }) => void) {
		onSubmit = fn;
	}

	return { show, hide, destroy, setOnSubmit };
}

function createPlugin(wsProvider?: WsProviderHandle): UsketchPlugin {
	let cleanup: (() => void) | undefined;

	return {
		id: "usketch-plugin-spatial-chat",
		name: "空間チャット",

		setup(ctx: PluginContext) {
			ctx.transient.registerType("chat-bubble", {
				render: (obj) => <ChatBubble obj={obj} />,
			});

			const chatDialog = createChatInputDialog();
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

			chatDialog.setOnSubmit(emitBubble);

			function onPointerDown(_toolCtx: ToolContext, event: CanvasPointerEvent) {
				chatDialog.show(event.worldPoint, event.screenPoint.x, event.screenPoint.y);
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
				chatDialog.destroy();
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
