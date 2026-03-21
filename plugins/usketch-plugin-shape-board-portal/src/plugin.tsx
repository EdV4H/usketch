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

const PORTAL_WIDTH = 240;
const PORTAL_HEIGHT = 160;

function renderContent(data: ShapeData) {
	const title = (data.boardTitle as string) || "Untitled";
	const ownerName = (data.ownerName as string) || "";
	const ownerImage = (data.ownerImage as string) || "";
	const memberCount = (data.memberCount as number) || 0;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "#fff",
				borderRadius: 12,
				border: "2px solid #e0e0e0",
				overflow: "hidden",
				fontFamily: "system-ui, sans-serif",
				display: "flex",
				flexDirection: "column",
				cursor: "pointer",
			}}
		>
			{/* プレビュー領域 */}
			<div
				style={{
					flex: 1,
					background: "#f8f9fa",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: 32,
					color: "#ddd",
				}}
			>
				⌂
			</div>
			{/* 情報バー */}
			<div
				style={{
					padding: "8px 12px",
					borderTop: "1px solid #eee",
					background: "#fff",
				}}
			>
				<div
					style={{
						fontSize: 13,
						fontWeight: 600,
						color: "#333",
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{title}
				</div>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 4,
						marginTop: 4,
						fontSize: 11,
						color: "#999",
					}}
				>
					{ownerImage && (
						<img
							src={ownerImage}
							alt=""
							style={{
								width: 14,
								height: 14,
								borderRadius: "50%",
							}}
						/>
					)}
					{ownerName && <span>{ownerName}</span>}
					{memberCount > 0 && <span style={{ marginLeft: "auto" }}>{memberCount} online</span>}
				</div>
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

function resize(data: ShapeData, handle: ResizeHandle, delta: Point): ShapeData {
	let { x, y, width, height } = data;
	switch (handle) {
		case "se":
			width += delta.x;
			height += delta.y;
			break;
		case "nw":
			x += delta.x;
			y += delta.y;
			width -= delta.x;
			height -= delta.y;
			break;
		case "ne":
			y += delta.y;
			width += delta.x;
			height -= delta.y;
			break;
		case "sw":
			x += delta.x;
			width -= delta.x;
			height += delta.y;
			break;
		case "e":
			width += delta.x;
			break;
		case "w":
			x += delta.x;
			width -= delta.x;
			break;
		case "n":
			y += delta.y;
			height -= delta.y;
			break;
		case "s":
			height += delta.y;
			break;
	}
	return {
		...data,
		x,
		y,
		width: Math.max(160, width),
		height: Math.max(120, height),
	};
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
	onPortalCreate?: (shapeId: string, position: { x: number; y: number }) => void;
}

export function createBoardPortalPlugin(options?: BoardPortalPluginOptions): UsketchPlugin {
	let cleanup: (() => void) | undefined;

	function renderWithDblClick(data: ShapeData) {
		const boardId = data.boardId as string;
		return (
			<foreignObject x={data.x} y={data.y} width={data.width} height={data.height}>
				{/* biome-ignore lint/a11y/useSemanticElements: foreignObject内でbuttonは使えない */}
				<div
					role="button"
					tabIndex={0}
					onDoubleClick={() => {
						if (boardId) options?.onPortalOpen?.(boardId);
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter" && boardId) options?.onPortalOpen?.(boardId);
					}}
					style={{
						width: "100%",
						height: "100%",
					}}
				>
					{renderContent(data)}
				</div>
			</foreignObject>
		);
	}

	return {
		id: "usketch-plugin-shape-board-portal",
		name: "ボードポータル",

		setup(ctx: PluginContext) {
			ctx.shapes.register("board-portal", {
				render: renderWithDblClick,
				getBounds,
				hitTest,
				resize,
				createDefault,
				renderTarget: "html",
				minSize: { width: 160, height: 120 },
			});

			// ポータル作成ツール
			let drawState: { startX: number; startY: number; shapeId: string } | null = null;

			ctx.tools.register("board-portal-create", {
				icon: PortalIcon,
				cursor: "crosshair",
				order: 5,
				onPointerDown: (toolCtx: ToolContext, event: CanvasPointerEvent) => {
					const id = generateId();
					drawState = {
						startX: event.worldPoint.x,
						startY: event.worldPoint.y,
						shapeId: id,
					};
					const shape = createDefault({
						id,
						x: event.worldPoint.x,
						y: event.worldPoint.y,
					});
					shape.width = 0;
					shape.height = 0;
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
						// ポータル作成をアプリに通知
						options?.onPortalCreate?.(drawState.shapeId, {
							x: shape.x,
							y: shape.y,
						});
					} else {
						toolCtx.store.deleteShape(drawState.shapeId);
					}
					drawState = null;
					toolCtx.store.setActiveToolId("select");
				},
			});

			cleanup = undefined;
		},

		teardown() {
			cleanup?.();
		},
	};
}
