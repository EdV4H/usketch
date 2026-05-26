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
import type { BoardPortalShapeData } from "./types.js";

export type { BoardPortalShapeData } from "./types.js";

const PORTAL_WIDTH = 200;
const PORTAL_HEIGHT = 120;
const MIN_PORTAL_W = 140;

/**
 * HSL ベースのカラーパレット — 彩度・明度を揃えて統一感を出す
 */
const PIN_HUES = [210, 0, 150, 35, 265, 330, 175, 20, 240, 190];

function pinHue(boardId: string): number {
	let hash = 0;
	for (let i = 0; i < boardId.length; i++) {
		hash = (hash * 31 + boardId.charCodeAt(i)) | 0;
	}
	return PIN_HUES[Math.abs(hash) % PIN_HUES.length] ?? 210;
}

function renderContent(shape: ShapeData) {
	const data = shape as BoardPortalShapeData;
	const title = data.boardTitle || "Untitled";
	const isPublic = data.isPublic !== false;
	const hue = pinHue(data.boardId || data.id);
	// themeColor は HSL から生成 — tokens.css の var は SVG/color-mix で使う
	const accentColor = `hsl(${hue}, 65%, 58%)`;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				position: "relative",
				pointerEvents: "none",
				userSelect: "none",
				overflow: "hidden",
				borderRadius: 16,
				// モックの isPortal 背景: themeColor 20% × bg-input のグラデーション
				background: `linear-gradient(135deg, color-mix(in oklab, ${accentColor} 20%, var(--bg-input)), var(--bg-input))`,
				border: `1.5px solid color-mix(in oklab, ${accentColor} 40%, transparent)`,
				padding: 14,
				display: "flex",
				flexDirection: "column",
				justifyContent: "space-between",
				boxSizing: "border-box",
				fontFamily: "var(--font-sans, system-ui, sans-serif)",
				boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
			}}
		>
			<div>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 7,
						marginBottom: 6,
					}}
				>
					<div
						style={{
							width: 22,
							height: 22,
							borderRadius: 6,
							background: `color-mix(in oklab, ${accentColor} 25%, transparent)`,
							color: accentColor,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						{isPublic ? (
							<svg
								width="11"
								height="11"
								viewBox="0 0 16 16"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<path d="M7 9a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5l-1 1" />
								<path d="M9 7a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 7 12.5l1-1" />
							</svg>
						) : (
							<svg
								width="11"
								height="11"
								viewBox="0 0 16 16"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<rect x="3.5" y="7" width="9" height="6.5" rx="1" />
								<path d="M5 7V5a3 3 0 0 1 6 0v2" />
							</svg>
						)}
					</div>
					<div
						style={{
							fontSize: 9.5,
							fontWeight: 700,
							color: accentColor,
							letterSpacing: 1,
							textTransform: "uppercase",
						}}
					>
						{isPublic ? "Portal" : "Private"}
					</div>
				</div>
				<div
					style={{
						fontSize: 14,
						fontWeight: 600,
						color: "var(--fg-primary)",
						letterSpacing: "-0.01em",
						overflow: "hidden",
						display: "-webkit-box",
						WebkitLineClamp: 2,
						WebkitBoxOrient: "vertical",
						lineHeight: 1.25,
						wordBreak: "break-word",
					}}
				>
					{title}
				</div>
			</div>

			<div
				style={{
					display: "inline-flex",
					alignItems: "center",
					gap: 5,
					alignSelf: "flex-start",
					padding: "4px 10px",
					borderRadius: 6,
					background: `color-mix(in oklab, ${accentColor} 25%, transparent)`,
					color: accentColor,
					fontSize: 11,
					fontWeight: 600,
				}}
			>
				開く
				<svg
					width="11"
					height="11"
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<path d="M2.5 8h11M10 4.5 13.5 8 10 11.5" />
				</svg>
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

const ASPECT = PORTAL_HEIGHT / PORTAL_WIDTH; // 0.6 (横長カード)

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
	const minW = MIN_PORTAL_W;
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

function createDefault(params: { id: string; x: number; y: number }): BoardPortalShapeData {
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
				minSize: { width: MIN_PORTAL_W, height: MIN_PORTAL_W * ASPECT },
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
					toolCtx.store.resetToDefaultTool();
				},
			});
		},
	};
}
