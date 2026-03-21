import type {
	CanvasPointerEvent,
	PluginContext,
	ToolContext,
	TransientObject,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import { useEffect, useRef } from "react";

const BUBBLE_TTL = 10000;
const INPUT_ID = "chat-input-active";

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

/**
 * チャットInput: transientとして1回だけemitされる。
 * EventBus経由でマウス位置を受け取り、DOM直接操作で追従。
 * Reactの再マウントを避けてフォーカスを維持する。
 */
function ChatInput({
	obj,
	onPlace,
	events,
}: {
	obj: TransientObject;
	onPlace: (text: string, worldPoint: { x: number; y: number }) => void;
	events: { on: <T>(event: string, handler: (data: T) => void) => () => void };
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const worldPointRef = useRef(obj.position);

	useEffect(() => {
		const unsub = events.on<{ screenX: number; screenY: number; worldX: number; worldY: number }>(
			"chat:cursormove",
			({ screenX, screenY, worldX, worldY }) => {
				worldPointRef.current = { x: worldX, y: worldY };
				if (containerRef.current) {
					containerRef.current.style.left = `${screenX + 16}px`;
					containerRef.current.style.top = `${screenY - 16}px`;
				}
			},
		);
		return unsub;
	}, [events]);

	useEffect(() => {
		setTimeout(() => inputRef.current?.focus(), 50);
	}, []);

	return (
		<div
			ref={containerRef}
			style={{
				position: "fixed",
				zIndex: 150,
				left: 0,
				top: 0,
			}}
		>
			<div
				style={{
					background: "#fff",
					borderRadius: 10,
					padding: "6px 10px",
					boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
					border: "2px solid #0066ff",
					minWidth: 180,
				}}
			>
				<input
					ref={inputRef}
					type="text"
					placeholder="Type and Enter..."
					maxLength={200}
					style={{
						width: "100%",
						padding: "4px 6px",
						fontSize: 13,
						border: "none",
						outline: "none",
						fontFamily: "system-ui, sans-serif",
						boxSizing: "border-box",
						background: "transparent",
					}}
					onKeyDown={(e) => {
						e.stopPropagation();
						if (e.key === "Enter" && !e.nativeEvent.isComposing) {
							e.preventDefault();
							const val = e.currentTarget.value.trim();
							if (val) {
								onPlace(val, worldPointRef.current);
								e.currentTarget.value = "";
							}
						}
					}}
					onPointerDown={(e) => e.stopPropagation()}
				/>
			</div>
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

function createPlugin(wsProvider?: WsProviderHandle): UsketchPlugin {
	let cleanup: (() => void) | undefined;

	return {
		id: "usketch-plugin-spatial-chat",
		name: "空間チャット",

		setup(ctx: PluginContext) {
			let bubbleCounter = 0;

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

			ctx.transient.registerType("chat-bubble", {
				render: (obj) => <ChatBubble obj={obj} />,
			});

			ctx.transient.registerType("chat-input", {
				render: (obj) => <ChatInput obj={obj} onPlace={emitBubble} events={ctx.events} />,
			});

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

			function showInput() {
				ctx.transient.emit({
					id: INPUT_ID,
					type: "chat-input",
					sourceUserId: "local",
					position: { x: 0, y: 0 },
					data: { interactive: true },
					createdAt: Date.now(),
				});
			}

			function hideInput() {
				ctx.transient.dismiss(INPUT_ID);
			}

			const TOOL_ID = "spatial-chat";

			ctx.tools.register(TOOL_ID, {
				icon: ChatIcon,
				cursor: "text",
				shortcut: "c",
				order: 65,
				onPointerMove: (_toolCtx: ToolContext, event: CanvasPointerEvent) => {
					ctx.events.emit("chat:cursormove", {
						screenX: event.screenPoint.x,
						screenY: event.screenPoint.y,
						worldX: event.worldPoint.x,
						worldY: event.worldPoint.y,
					});
				},
				onPointerDown: (_toolCtx: ToolContext, event: CanvasPointerEvent) => {
					const inputEl = document.querySelector<HTMLInputElement>(
						'input[placeholder="Type and Enter..."]',
					);
					if (inputEl?.value.trim()) {
						emitBubble(inputEl.value.trim(), event.worldPoint);
						inputEl.value = "";
					}
					// pointerdown後にブラウザがキャンバスにフォーカスを移すので遅延で戻す
					setTimeout(() => inputEl?.focus(), 0);
				},
			});

			let wasActive = ctx.store.getActiveToolId() === TOOL_ID;
			if (wasActive) showInput();

			const unsubToolChange = ctx.store.subscribe(() => {
				const isActive = ctx.store.getActiveToolId() === TOOL_ID;
				if (isActive && !wasActive) {
					showInput();
				} else if (!isActive && wasActive) {
					hideInput();
				}
				wasActive = isActive;
			});

			cleanup = () => {
				unsubBroadcast?.();
				unsubToolChange();
				hideInput();
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
