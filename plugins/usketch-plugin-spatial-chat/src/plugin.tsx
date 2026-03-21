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
 * カーソルに追従するフローティングInput。
 * ツール選択中は常に表示され、マウス移動に追従する。
 */
function createFloatingInput() {
	let onPlace: ((text: string, worldPoint: { x: number; y: number }) => void) | null = null;
	let currentWorldPoint = { x: 0, y: 0 };

	const container = document.createElement("div");
	Object.assign(container.style, {
		position: "fixed",
		zIndex: "150",
		display: "none",
	});

	const inputWrap = document.createElement("div");
	Object.assign(inputWrap.style, {
		background: "#fff",
		borderRadius: "10px",
		padding: "6px 10px",
		boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
		border: "2px solid #0066ff",
		pointerEvents: "auto",
		minWidth: "180px",
	});

	const input = document.createElement("input");
	input.type = "text";
	input.placeholder = "Type and click to place...";
	input.maxLength = 200;
	Object.assign(input.style, {
		width: "100%",
		padding: "4px 6px",
		fontSize: "13px",
		border: "none",
		outline: "none",
		fontFamily: "system-ui, sans-serif",
		boxSizing: "border-box",
		background: "transparent",
	});

	input.addEventListener("keydown", (e) => {
		e.stopPropagation();
		if (e.key === "Enter") {
			e.preventDefault();
			if (input.value.trim()) {
				onPlace?.(input.value.trim(), currentWorldPoint);
				input.value = "";
			}
		}
	});

	inputWrap.appendChild(input);
	container.appendChild(inputWrap);
	document.body.appendChild(container);

	function show() {
		container.style.display = "block";
		input.value = "";
		// 確実にフォーカスが当たるよう少し遅延
		setTimeout(() => input.focus(), 50);
	}

	function hide() {
		container.style.display = "none";
		input.value = "";
	}

	function moveTo(screenX: number, screenY: number, worldPoint: { x: number; y: number }) {
		currentWorldPoint = worldPoint;
		// Inputはカーソルの右下に表示
		const pad = 8;
		const left = Math.min(screenX + 16, window.innerWidth - 200 - pad);
		const top = Math.min(screenY + 16, window.innerHeight - 40 - pad);
		container.style.left = `${Math.max(pad, left)}px`;
		container.style.top = `${Math.max(pad, top)}px`;
	}

	function placeAtCursor() {
		if (input.value.trim()) {
			onPlace?.(input.value.trim(), currentWorldPoint);
			input.value = "";
			input.focus();
		}
	}

	function destroy() {
		container.remove();
	}

	function setOnPlace(fn: (text: string, worldPoint: { x: number; y: number }) => void) {
		onPlace = fn;
	}

	return { show, hide, moveTo, placeAtCursor, destroy, setOnPlace };
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

			const floatingInput = createFloatingInput();
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
				console.log("[chat] emitBubble", { text, point });
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

			floatingInput.setOnPlace(emitBubble);

			const TOOL_ID = "spatial-chat";

			ctx.tools.register(TOOL_ID, {
				icon: ChatIcon,
				cursor: "text",
				shortcut: "c",
				order: 65,
				onPointerMove: (_toolCtx: ToolContext, event: CanvasPointerEvent) => {
					floatingInput.moveTo(event.screenPoint.x, event.screenPoint.y, event.worldPoint);
				},
				onPointerDown: () => {
					floatingInput.placeAtCursor();
				},
			});

			// onActivateが未実装なので、store subscribeでツール切替を検知
			let wasActive = ctx.store.getActiveToolId() === TOOL_ID;
			if (wasActive) floatingInput.show();

			const unsubToolChange = ctx.store.subscribe(() => {
				const isActive = ctx.store.getActiveToolId() === TOOL_ID;
				if (isActive && !wasActive) {
					floatingInput.show();
				} else if (!isActive && wasActive) {
					floatingInput.hide();
				}
				wasActive = isActive;
			});

			cleanup = () => {
				unsubBroadcast?.();
				unsubToolChange();
				floatingInput.destroy();
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
