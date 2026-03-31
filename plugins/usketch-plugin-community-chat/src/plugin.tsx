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

export interface CommunityChatOptions {
	apiUrl: string;
	extraHeaders?: Record<string, string>;
	wsProvider: WsProviderHandle | null;
	userId: string;
	userName: string;
}

// ── ピン定数 ──

const PIN_W = 64;
const PIN_H = 80;
const ASPECT = PIN_H / PIN_W;
const MIN_W = 40;
const PIN_HUE = 200;

// ── ピン描画 ──

function pinPath(cx: number, cy: number, r: number, tipY: number): string {
	const angle = Math.PI / 5;
	const sinA = Math.sin(angle);
	const cosA = Math.cos(angle);
	const tx = cx + r * sinA;
	const ty = cy + r * cosA;
	const lx = cx - r * sinA;
	const ly = ty;
	return [`M${cx} ${tipY}`, `L${tx} ${ty}`, `A${r} ${r} 0 1 0 ${lx} ${ly}`, "Z"].join(" ");
}

function renderChatPin(data: ShapeData) {
	const label = (data.chatLabel as string) || "Chat";
	const w = data.width;
	const h = data.height;

	const labelH = h * 0.25;
	const pinH = h - labelH;
	const r = w * 0.4;
	const cx = w / 2;
	const cy = h * 0.02 + r;
	const tipY = pinH - h * 0.01;

	const uid = `chat-pin-${data.id}`;
	const lightColor = `hsl(${PIN_HUE}, 70%, 68%)`;
	const darkColor = `hsl(${PIN_HUE}, 60%, 38%)`;
	const iconColor = `hsl(${PIN_HUE}, 55%, 45%)`;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				position: "relative",
				pointerEvents: "none",
				userSelect: "none",
				overflow: "hidden",
			}}
		>
			<svg
				width={w}
				height={pinH}
				viewBox={`0 0 ${w} ${pinH}`}
				style={{ position: "absolute", top: 0, left: 0 }}
			>
				<title>{label}</title>
				<defs>
					<linearGradient id={`${uid}-grad`} x1="0" y1="0" x2="0.3" y2="1">
						<stop offset="0%" stopColor={lightColor} />
						<stop offset="100%" stopColor={darkColor} />
					</linearGradient>
					<radialGradient id={`${uid}-hl`} cx="0.4" cy="0.35" r="0.6">
						<stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
						<stop offset="100%" stopColor="rgba(255,255,255,0)" />
					</radialGradient>
				</defs>
				<ellipse cx={cx} cy={tipY + 1} rx={r * 0.3} ry={2} fill="rgba(0,0,0,0.1)" />
				<path d={pinPath(cx, cy, r, tipY)} fill={`url(#${uid}-grad)`} />
				<circle cx={cx} cy={cy} r={r} fill={`url(#${uid}-hl)`} />
				<circle cx={cx} cy={cy} r={r * 0.58} fill="#fff" />
				<g transform={`translate(${cx - r * 0.32}, ${cy - r * 0.3}) scale(${(r * 0.64) / 20})`}>
					<path
						d="M4 3h12a2 2 0 012 2v7a2 2 0 01-2 2H8l-4 3v-3H4a2 2 0 01-2-2V5a2 2 0 012-2z"
						fill="none"
						stroke={iconColor}
						strokeWidth="1.8"
						strokeLinejoin="round"
					/>
					<line
						x1="7"
						y1="7"
						x2="13"
						y2="7"
						stroke={iconColor}
						strokeWidth="1.4"
						strokeLinecap="round"
					/>
					<line
						x1="7"
						y1="10"
						x2="11"
						y2="10"
						stroke={iconColor}
						strokeWidth="1.4"
						strokeLinecap="round"
					/>
				</g>
				<circle cx={cx - r * 0.28} cy={cy - r * 0.28} r={r * 0.08} fill="rgba(255,255,255,0.5)" />
			</svg>
			<div
				style={{
					position: "absolute",
					bottom: 0,
					left: 0,
					width: w,
					height: labelH,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<span
					style={{
						fontSize: Math.max(9, Math.min(13, h * 0.11)),
						fontWeight: 600,
						color: "#334155",
						fontFamily: "system-ui, sans-serif",
						background: "rgba(255,255,255,0.88)",
						padding: "2px 6px",
						borderRadius: 8,
						maxWidth: "100%",
						overflow: "hidden",
						display: "-webkit-box",
						WebkitLineClamp: 2,
						WebkitBoxOrient: "vertical",
						textAlign: "center",
						lineHeight: 1.25,
						wordBreak: "break-word",
					}}
				>
					{label}
				</span>
			</div>
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

function createDefault(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "chat-widget",
		x: params.x,
		y: params.y,
		width: PIN_W,
		height: PIN_H,
		style: { ...DEFAULT_STYLE, fill: "#ffffff", stroke: "#e2e8f0" },
		chatLabel: "Chat",
		threadId: generateId(),
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
				const threadId = (shape.threadId as string) || "default";
				if (shapeId !== prevSelectedChatId) {
					prevSelectedChatId = shapeId;
					activeThreadId = threadId;
					// タブを再登録してスレッドを切り替え
					ctx.events.emit("side-panel:unregister-tab", { tabId: "community-chat" });
					ctx.events.emit("side-panel:register-tab", {
						tab: {
							id: "community-chat",
							label: (shape.chatLabel as string) || "Chat",
							icon: "\u{1F4AC}",
							order: 3,
							render: () => (
								<ChatTab
									client={client}
									wsProvider={options.wsProvider}
									userId={options.userId}
									userName={options.userName}
									threadId={activeThreadId}
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
				ctx.events.emit("side-panel:unregister-tab", { tabId: "community-chat" });
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}
