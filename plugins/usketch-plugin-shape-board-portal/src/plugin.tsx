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

const PORTAL_WIDTH = 64;
const PORTAL_HEIGHT = 80;
const MIN_PIN_W = 40;

/**
 * HSL ベースのカラーパレット — 彩度・明度を揃えて統一感を出す
 */
const PIN_HUES = [210, 0, 150, 35, 265, 330, 175, 20, 240, 190];

function pinHue(boardId: string): number {
	let hash = 0;
	for (let i = 0; i < boardId.length; i++) {
		hash = (hash * 31 + boardId.charCodeAt(i)) | 0;
	}
	return PIN_HUES[Math.abs(hash) % PIN_HUES.length];
}

/**
 * Google Maps 風ドロップピンの SVG path を生成。
 * cx, cy: 円の中心。r: 円の半径。tipY: 先端の Y 座標。
 */
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

function renderContent(data: ShapeData) {
	const title = (data.boardTitle as string) || "Untitled";
	const isPublic = data.isPublic !== false;
	const hue = pinHue((data.boardId as string) || data.id);
	const w = data.width;
	const h = data.height;

	// すべて比率ベースでレイアウト（サイズ変更で崩れない）
	const labelH = h * 0.25; // 下25%がラベル（2行分）
	const pinH = h - labelH;

	const r = w * 0.4; // 円の半径 = 幅の40%
	const cx = w / 2;
	const cy = h * 0.02 + r; // 円の中心（上端2% + r）
	const tipY = pinH - h * 0.01; // 先端

	const uid = `pin-${data.id}`;
	const lightColor = `hsl(${hue}, 70%, 68%)`;
	const darkColor = `hsl(${hue}, 60%, 38%)`;
	const iconColor = `hsl(${hue}, 55%, 45%)`;

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
				<title>{title}</title>
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

				{/* 地面の影 */}
				<ellipse cx={cx} cy={tipY + 1} rx={r * 0.3} ry={2} fill="rgba(0,0,0,0.1)" />

				{/* ピン本体 */}
				<path d={pinPath(cx, cy, r, tipY)} fill={`url(#${uid}-grad)`} />

				{/* ハイライト */}
				<circle cx={cx} cy={cy} r={r} fill={`url(#${uid}-hl)`} />

				{/* 白い内円 */}
				<circle cx={cx} cy={cy} r={r * 0.58} fill="#fff" />

				{/* アイコン: ホワイトボード (Public) / ロック (Private) */}
				{isPublic ? (
					<g transform={`translate(${cx - r * 0.32}, ${cy - r * 0.32}) scale(${(r * 0.64) / 24})`}>
						{/* ボード外枠 */}
						<rect
							x="1"
							y="3"
							width="22"
							height="16"
							rx="2.5"
							fill="none"
							stroke={iconColor}
							strokeWidth="2"
						/>
						{/* 付箋1 */}
						<rect x="4" y="6" width="6" height="5" rx="0.8" fill={`hsl(${hue}, 60%, 75%)`} />
						{/* 付箋2 */}
						<rect
							x="12"
							y="6"
							width="8"
							height="4"
							rx="0.8"
							fill={`hsl(${(hue + 40) % 360}, 55%, 72%)`}
						/>
						{/* テキスト行 */}
						<line
							x1="12"
							y1="13"
							x2="20"
							y2="13"
							stroke={iconColor}
							strokeWidth="1.5"
							strokeLinecap="round"
						/>
						<line
							x1="4"
							y1="15"
							x2="10"
							y2="15"
							stroke={iconColor}
							strokeWidth="1.2"
							strokeLinecap="round"
							opacity="0.5"
						/>
					</g>
				) : (
					<g transform={`translate(${cx - r * 0.25}, ${cy - r * 0.32}) scale(${(r * 0.5) / 16})`}>
						<rect x="2" y="7" width="12" height="9" rx="2" fill={iconColor} />
						<path
							d="M5 7V5a3 3 0 016 0v2"
							fill="none"
							stroke={iconColor}
							strokeWidth="2"
							strokeLinecap="round"
						/>
					</g>
				)}

				{/* キャッチライト */}
				<circle cx={cx - r * 0.28} cy={cy - r * 0.28} r={r * 0.08} fill="rgba(255,255,255,0.5)" />
			</svg>

			{/* タイトルラベル — bounds 内下部に配置 */}
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
					{title}
				</span>
			</div>
		</div>
	);
}

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

const ASPECT = PORTAL_HEIGHT / PORTAL_WIDTH; // 1.25

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
	const minW = MIN_PIN_W;
	const minH = minW * ASPECT;
	if (width < minW) {
		// clamp してから x/y を再計算（アンカー辺がジャンプしないように）
		const clampedW = minW;
		const clampedH = minH;
		switch (handle) {
			case "nw":
				x = data.x + data.width - clampedW;
				y = data.y + data.height - clampedH;
				break;
			case "ne":
				y = data.y + data.height - clampedH;
				break;
			case "sw":
				x = data.x + data.width - clampedW;
				break;
			case "w":
				x = data.x + data.width - clampedW;
				break;
			case "n":
			case "s":
				x = data.x + (data.width - clampedW) / 2;
				break;
		}
		width = clampedW;
		height = clampedH;
	}
	return { ...data, x, y, width, height };
}

function createDefault(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "board-portal",
		x: params.x,
		y: params.y,
		width: PORTAL_WIDTH,
		height: PORTAL_HEIGHT,
		style: { ...DEFAULT_STYLE, fill: "#ffffff", stroke: "#e0e0e0" },
		boardId: "",
		boardTitle: "Untitled",
		ownerName: "",
		ownerImage: "",
		memberCount: 0,
		isPublic: true,
	};
}

function PortalIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<title>Board</title>
			<rect
				x="2"
				y="3"
				width="16"
				height="14"
				rx="2"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<line x1="2" y1="7" x2="18" y2="7" stroke="currentColor" strokeWidth="1" />
			<circle cx="5" cy="5" r="1" fill="currentColor" opacity="0.4" />
			<circle cx="8" cy="5" r="1" fill="currentColor" opacity="0.4" />
		</svg>
	);
}

export interface BoardPortalPluginOptions {
	onPortalOpen?: (boardId: string) => void;
	onPortalCreate?: (shapeId: string, position: { x: number; y: number }, isPublic: boolean) => void;
}

export function createBoardPortalPlugin(options?: BoardPortalPluginOptions): UsketchPlugin {
	function renderPortal(data: ShapeData) {
		return renderContent(data);
	}

	return {
		id: "usketch-plugin-shape-board-portal",
		name: "ボードポータル",

		setup(ctx: PluginContext) {
			ctx.shapes.register("board-portal", {
				render: renderPortal,
				getBounds,
				hitTest,
				resize,
				createDefault,
				renderTarget: "html",
				minSize: { width: MIN_PIN_W, height: MIN_PIN_W * ASPECT },
			});

			// ポータル作成ツール
			let drawState: {
				startX: number;
				startY: number;
				shapeId: string;
				isPublic: boolean;
			} | null = null;

			ctx.tools.register("board-portal-create", {
				icon: PortalIcon,
				cursor: "crosshair",
				shortcut: "b",
				order: 5,
				onPointerDown: (toolCtx: ToolContext, event: CanvasPointerEvent) => {
					const id = generateId();
					const isPublic = !event.shiftKey;
					drawState = {
						startX: event.worldPoint.x,
						startY: event.worldPoint.y,
						shapeId: id,
						isPublic,
					};
					const shape = createDefault({
						id,
						x: event.worldPoint.x,
						y: event.worldPoint.y,
					});
					shape.width = 0;
					shape.height = 0;
					shape.isPublic = isPublic;
					toolCtx.store.addShape(shape);
				},
				onPointerMove: (toolCtx: ToolContext, event: CanvasPointerEvent) => {
					if (!drawState) return;
					const x = Math.min(drawState.startX, event.worldPoint.x);
					const y = Math.min(drawState.startY, event.worldPoint.y);
					const width = Math.abs(event.worldPoint.x - drawState.startX);
					const height = Math.abs(event.worldPoint.y - drawState.startY);
					toolCtx.store.updateShape(drawState.shapeId, { x, y, width, height });
				},
				onPointerUp: (toolCtx: ToolContext) => {
					if (!drawState) return;
					const shape = toolCtx.store.getShape(drawState.shapeId);
					if (shape && shape.width > 20 && shape.height > 20) {
						// undo可能なコマンドに置き換え
						toolCtx.store.deleteShape(drawState.shapeId);
						toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, shape));
						// ポータル作成をアプリに通知
						options?.onPortalCreate?.(
							drawState.shapeId,
							{ x: shape.x, y: shape.y },
							drawState.isPublic,
						);
					} else {
						toolCtx.store.deleteShape(drawState.shapeId);
					}
					drawState = null;
					toolCtx.store.setActiveToolId("select");
				},
			});
		},
	};
}
