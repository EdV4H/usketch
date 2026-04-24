import {
	type BoundingBox,
	type CanvasPointerEvent,
	DEFAULT_STYLE,
	generateId,
	type PluginContext,
	type Point,
	type ResizeHandle,
	type ShapeData,
	type ToolContext,
	type UsketchPlugin,
} from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import { createChatClient } from "./chat-client.js";
import type { ChatNewMessageEvent, ChatWidgetShapeData } from "./types.js";

export interface CommunityChatOptions {
	apiUrl: string;
	extraHeaders?: Record<string, string>;
	wsProvider: WsProviderHandle | null;
	userId: string;
	userName: string;
}

// ── ピン定数 ──
// モックの ChatThreadPin (expanded 状態) 相当: 横長の pill 型
const PIN_W = 280;
const PIN_H = 60;
const ASPECT = PIN_H / PIN_W;
const MIN_W = 180;

// threadId をハッシュしてアバター色を決める
const THREAD_HUES = [265, 330, 195, 150, 20, 210, 0, 175, 240, 35];
function threadHue(id: string): number {
	let hash = 0;
	for (let i = 0; i < id.length; i++) {
		hash = (hash * 31 + id.charCodeAt(i)) | 0;
	}
	return THREAD_HUES[Math.abs(hash) % THREAD_HUES.length] ?? 265;
}

function formatRelativeTime(iso: string): string {
	const then = new Date(iso).getTime();
	if (!Number.isFinite(then)) return "";
	const diff = Date.now() - then;
	if (diff < 0) return "今";
	const sec = Math.floor(diff / 1000);
	if (sec < 60) return "今";
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}分前`;
	const hr = Math.floor(min / 60);
	if (hr < 24) return `${hr}時間前`;
	const day = Math.floor(hr / 24);
	if (day < 7) return `${day}日前`;
	return new Date(iso).toLocaleDateString();
}

// ── ピン描画 ──

function renderChatPin(shape: ShapeData) {
	const data = shape as ChatWidgetShapeData;
	const label = data.chatLabel || "Chat";
	const lastMessage = data.lastMessage || "";
	const lastAuthor = data.lastAuthor || "";
	const lastMessageAt = data.lastMessageAt || "";
	const unread = Number(data.unread ?? 0);
	const hue = threadHue(data.threadId || data.id);
	const accentColor = `hsl(${hue}, 70%, 60%)`;
	const softColor = `hsl(${hue}, 70%, 85%)`;
	const relTime = lastMessageAt ? formatRelativeTime(lastMessageAt) : "";

	// tail を含めるため、外側ラッパーは overflow: visible で、
	// 内部の pill だけに overflow: hidden をかける。
	// tail は pill の下辺から張り出す SVG で描画し、pill 背景と border を一筆で継承する。
	const TAIL_W = 14;
	const TAIL_H = 8;
	const TAIL_OFFSET_LEFT = 24; // アバター中心の少し右下から生やす

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				position: "relative",
				pointerEvents: "none",
				userSelect: "none",
				boxSizing: "border-box",
				fontFamily: "var(--font-sans, system-ui, sans-serif)",
				filter: `drop-shadow(0 6px 14px color-mix(in oklab, ${accentColor} 28%, transparent))`,
			}}
		>
			{/* pill 本体 */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					display: "flex",
					alignItems: "center",
					gap: 10,
					padding: "8px 14px 8px 8px",
					background: "var(--bg-surface-raised)",
					border: `1.5px solid ${accentColor}`,
					borderRadius: 99,
					backdropFilter: "blur(20px) saturate(1.4)",
					WebkitBackdropFilter: "blur(20px) saturate(1.4)",
					overflow: "hidden",
					boxSizing: "border-box",
				}}
			>
				{/* アバター (comment icon) */}
				<div
					style={{
						width: 32,
						height: 32,
						borderRadius: 99,
						flexShrink: 0,
						background: `linear-gradient(135deg, ${accentColor}, ${softColor})`,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						position: "relative",
					}}
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 16 16"
						fill="none"
						stroke="white"
						strokeWidth="1.8"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<path d="M2.5 7.5c0-2.8 2.5-5 5.5-5s5.5 2.2 5.5 5-2.5 5-5.5 5c-.7 0-1.4-.1-2-.3L3 13.5l.8-2.4a4.8 4.8 0 0 1-1.3-3.6Z" />
					</svg>
					{unread > 0 && (
						<div
							style={{
								position: "absolute",
								top: -3,
								right: -3,
								minWidth: 16,
								height: 16,
								padding: "0 4px",
								borderRadius: 99,
								background: "var(--danger)",
								color: "white",
								fontSize: 9.5,
								fontWeight: 700,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								border: "2px solid var(--bg-canvas)",
							}}
						>
							{unread > 99 ? "99+" : unread}
						</div>
					)}
				</div>

				{/* タイトル + 最終メッセージ */}
				<div style={{ minWidth: 0, lineHeight: 1.25, flex: 1 }}>
					<div
						style={{
							display: "flex",
							alignItems: "baseline",
							gap: 6,
							minWidth: 0,
						}}
					>
						<div
							style={{
								fontSize: 12,
								fontWeight: 600,
								color: "var(--fg-primary)",
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
								flex: 1,
								minWidth: 0,
							}}
							title={label}
						>
							{label}
						</div>
						{relTime && (
							<div
								style={{
									fontSize: 9.5,
									color: "var(--fg-tertiary)",
									fontFamily: "var(--font-mono)",
									flexShrink: 0,
								}}
							>
								{relTime}
							</div>
						)}
					</div>
					{lastMessage && (
						<div
							style={{
								fontSize: 10.5,
								color: "var(--fg-tertiary)",
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							}}
						>
							{lastAuthor && (
								<span style={{ color: accentColor, fontWeight: 500 }}>{lastAuthor}: </span>
							)}
							{lastMessage}
						</div>
					)}
				</div>
			</div>

			{/* tail — pill の下辺に張り出す三角 (SVG) */}
			<svg
				aria-hidden="true"
				width={TAIL_W}
				height={TAIL_H + 2}
				viewBox={`0 0 ${TAIL_W} ${TAIL_H + 2}`}
				style={{
					position: "absolute",
					left: TAIL_OFFSET_LEFT,
					// pill の下端線にちょうど重ねる。pill の border 1.5px の外側に出すため少し上から。
					bottom: -(TAIL_H + 1),
					pointerEvents: "none",
				}}
			>
				{/* pill の border と同色のアウトライン三角 (下向き ▼) */}
				<path
					d={`M0 0 L${TAIL_W} 0 L${TAIL_W / 2} ${TAIL_H} Z`}
					fill="var(--bg-surface-raised)"
					stroke={accentColor}
					strokeWidth="1.5"
					strokeLinejoin="round"
				/>
				{/* pill の底辺 border と tail の上端を重ねて、接地部分の 2 重線を隠す */}
				<line
					x1="1"
					y1="0"
					x2={TAIL_W - 1}
					y2="0"
					stroke="var(--bg-surface-raised)"
					strokeWidth="2"
				/>
			</svg>
		</div>
	);
}

// ── シェイプ関数 ──

function getBounds(data: ShapeData): BoundingBox {
	return { x: data.x, y: data.y, width: data.width, height: data.height };
}

function hitTest(data: ShapeData, point: Point): boolean {
	return (
		point.x >= data.x &&
		point.x <= data.x + data.width &&
		point.y >= data.y &&
		point.y <= data.y + data.height
	);
}

function resize(data: ShapeData, handle: ResizeHandle, delta: Point): ShapeData {
	let { x, y, width, height } = data;
	switch (handle) {
		case "se":
			width += delta.x;
			height = width * ASPECT;
			break;
		case "nw": {
			const newW = width - delta.x;
			x = data.x + data.width - newW;
			y = data.y + data.height - newW * ASPECT;
			width = newW;
			height = newW * ASPECT;
			break;
		}
		case "ne": {
			width += delta.x;
			y = data.y + data.height - width * ASPECT;
			height = width * ASPECT;
			break;
		}
		case "sw": {
			const newW = width - delta.x;
			x = data.x + data.width - newW;
			width = newW;
			height = newW * ASPECT;
			break;
		}
		case "e":
			width += delta.x;
			height = width * ASPECT;
			break;
		case "w": {
			const newW = width - delta.x;
			x = data.x + data.width - newW;
			width = newW;
			height = newW * ASPECT;
			break;
		}
		case "n": {
			height -= delta.y;
			const newW = height / ASPECT;
			x = data.x + (data.width - newW) / 2;
			y += delta.y;
			width = newW;
			break;
		}
		case "s":
			height += delta.y;
			width = height / ASPECT;
			x = data.x + (data.width - width) / 2;
			break;
	}
	const minH = MIN_W * ASPECT;
	if (width < MIN_W) {
		width = MIN_W;
		height = minH;
	}
	return { ...data, x, y, width, height };
}

function createDefault(params: { id: string; x: number; y: number }): ChatWidgetShapeData {
	return {
		id: params.id,
		type: "chat-widget",
		x: params.x,
		y: params.y,
		width: PIN_W,
		height: PIN_H,
		style: { ...DEFAULT_STYLE, fill: "transparent", stroke: "transparent", strokeWidth: 0 },
		chatLabel: "Chat",
		threadId: generateId(),
		unread: 0,
	};
}

function ChatIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<title>Chat</title>
			<path
				d="M4 4h12a2 2 0 012 2v7a2 2 0 01-2 2H8l-4 3v-3a2 2 0 01-2-2V6a2 2 0 012-2z"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinejoin="round"
			/>
			<line
				x1="7"
				y1="8"
				x2="13"
				y2="8"
				stroke="currentColor"
				strokeWidth="1.2"
				strokeLinecap="round"
			/>
			<line
				x1="7"
				y1="11"
				x2="11"
				y2="11"
				stroke="currentColor"
				strokeWidth="1.2"
				strokeLinecap="round"
			/>
		</svg>
	);
}

// ── プラグイン ──

export function createCommunityChatPlugin(options: CommunityChatOptions): UsketchPlugin {
	let cleanup: (() => void) | undefined;

	const client = createChatClient({
		apiUrl: options.apiUrl,
		extraHeaders: options.extraHeaders,
	});

	return {
		id: "usketch-plugin-community-chat",
		name: "Community Chat",

		async setup(ctx: PluginContext) {
			const { ChatTab } = await import("./chat-tab.js");

			// 現在選択中のスレッドID を追跡
			let activeThreadId = "default";

			// サイドパネルタブ登録 — render 内で activeThreadId を参照
			ctx.events.emit("side-panel:register-tab", {
				tab: {
					id: "community-chat",
					label: "Chat",
					icon: "\u{1F4AC}",
					order: 3,
					render: () => (
						<ChatTab
							client={client}
							wsProvider={options.wsProvider}
							userId={options.userId}
							userName={options.userName}
							threadId={activeThreadId}
							events={ctx.events}
						/>
					),
				},
			});

			// チャットピンシェイプ登録
			ctx.shapes.register("chat-widget", {
				render: renderChatPin,
				getBounds,
				hitTest,
				resize,
				createDefault,
				renderTarget: "html",
				minSize: { width: MIN_W, height: MIN_W * ASPECT },
			});

			// chat-widget シェイプの最終メッセージ / unread を更新するイベント購読
			const unsubNewMessage = ctx.events.on<ChatNewMessageEvent>(
				"chat-widget:new-message",
				({ message, fromActiveTab }) => {
					const shapes = ctx.store.getShapes();
					for (const [id, shape] of shapes) {
						if (shape.type !== "chat-widget") continue;
						const data = shape as ChatWidgetShapeData;
						if (data.threadId !== message.threadId) continue;
						const prevUnread = Number(data.unread ?? 0);
						const nextUnread = fromActiveTab ? 0 : prevUnread + 1;
						ctx.store.updateShape(id, {
							lastMessage: message.text,
							lastAuthor: message.authorName,
							lastAuthorId: message.authorId,
							lastMessageAt: message.createdAt,
							unread: nextUnread,
						} as Partial<ChatWidgetShapeData>);
					}
				},
			);

			// アクティブスレッド切替時 / タブを開いた時、そのスレッドの unread をリセット
			const clearUnreadForThread = (threadId: string) => {
				const shapes = ctx.store.getShapes();
				for (const [id, shape] of shapes) {
					if (shape.type !== "chat-widget") continue;
					const data = shape as ChatWidgetShapeData;
					if (data.threadId !== threadId) continue;
					if (Number(data.unread ?? 0) === 0) continue;
					ctx.store.updateShape(id, { unread: 0 } as Partial<ChatWidgetShapeData>);
				}
			};

			// 初期ロード時: 画面にある chat-widget シェイプ全ての最新メッセージを fetch して反映
			// （新規 shape が後から増えたときのためにも、追加時に再 fetch する）
			const refreshShapeMetadata = async (shapeId: string, threadId: string) => {
				const msgs = await client.list(threadId, 1);
				const last = msgs[msgs.length - 1];
				if (!last) return;
				const shape = ctx.store.getShape(shapeId);
				if (!shape || shape.type !== "chat-widget") return;
				const data = shape as ChatWidgetShapeData;
				if (data.lastMessageAt === last.createdAt) return; // 変更なし
				ctx.store.updateShape(shapeId, {
					lastMessage: last.text,
					lastAuthor: last.authorName,
					lastAuthorId: last.authorId,
					lastMessageAt: last.createdAt,
				} as Partial<ChatWidgetShapeData>);
			};

			// 初期同期: 現在ある chat-widget シェイプ全てを 1 回 fetch
			setTimeout(() => {
				const shapes = ctx.store.getShapes();
				for (const [id, shape] of shapes) {
					if (shape.type !== "chat-widget") continue;
					const threadId = (shape as ChatWidgetShapeData).threadId || "";
					if (threadId) refreshShapeMetadata(id, threadId);
				}
			}, 0);

			// 新規 chat-widget が追加されたら fetch
			const unsubShapeAdd = ctx.store.onMutation((event) => {
				if (event.type !== "shape:added") return;
				const payload = event.payload as { id?: string } | null | undefined;
				const shapeId = payload?.id;
				if (typeof shapeId !== "string") return;
				const shape = ctx.store.getShape(shapeId);
				if (!shape || shape.type !== "chat-widget") return;
				const threadId = (shape as ChatWidgetShapeData).threadId || "";
				if (threadId) refreshShapeMetadata(shapeId, threadId);
			});

			// チャットピン選択時 → そのスレッドをサイドパネルで開く
			let prevSelectedChatId: string | null = null;

			const unsubMutation = ctx.store.onMutation(() => {
				const selection = ctx.store.getSelection();
				if (selection.size !== 1) {
					prevSelectedChatId = null;
					return;
				}
				const shapeId = [...selection][0];
				const shape = ctx.store.getShape(shapeId);
				if (!shape || shape.type !== "chat-widget") {
					prevSelectedChatId = null;
					return;
				}
				const data = shape as ChatWidgetShapeData;
				const threadId = data.threadId || "default";
				if (shapeId !== prevSelectedChatId) {
					prevSelectedChatId = shapeId;
					activeThreadId = threadId;
					clearUnreadForThread(threadId);
					// タブを再登録してスレッドを切り替え
					ctx.events.emit("side-panel:unregister-tab", { tabId: "community-chat" });
					ctx.events.emit("side-panel:register-tab", {
						tab: {
							id: "community-chat",
							label: data.chatLabel || "Chat",
							icon: "\u{1F4AC}",
							order: 3,
							render: () => (
								<ChatTab
									client={client}
									wsProvider={options.wsProvider}
									userId={options.userId}
									userName={options.userName}
									threadId={activeThreadId}
									events={ctx.events}
								/>
							),
						},
					});
					ctx.events.emit("side-panel:open", { tabId: "community-chat" });
				}
			});

			// チャットピン作成ツール
			ctx.tools.register("chat-widget-create", {
				icon: ChatIcon,
				cursor: "crosshair",
				shortcut: undefined,
				order: 6,
				onPointerDown: (_toolCtx: ToolContext, _event: CanvasPointerEvent) => {},
				onPointerMove: (_toolCtx: ToolContext, _event: CanvasPointerEvent) => {},
				onPointerUp: (toolCtx: ToolContext, event: CanvasPointerEvent) => {
					const id = generateId();
					const shape = createDefault({
						id,
						x: event.worldPoint.x - PIN_W / 2,
						y: event.worldPoint.y - PIN_H / 2,
					});
					toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, shape));
					toolCtx.store.setActiveToolId("select");
				},
			});

			cleanup = () => {
				unsubMutation();
				unsubNewMessage();
				unsubShapeAdd();
				ctx.events.emit("side-panel:unregister-tab", { tabId: "community-chat" });
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}
