import { createEditableTextController, editableTextProps } from "@edv4h/usketch-shape-utils";
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
	withRotation,
} from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";

/** Text shape extension: intrinsic data for the `text` shape. */
export interface TextShapeData extends ShapeData {
	text: string;
	fontSize: number;
	fontFamily: string;
	isEditing: boolean;
}

/**
 * LOD component: first line of text, truncated. Dropped editing + focus ring.
 */
function SimplifiedText({ shape }: { shape: ShapeData }) {
	const data = shape as TextShapeData;
	const text = String(data.text ?? "").split("\n")[0] ?? "";
	const color = data.style?.stroke || "#222";
	const rotation = typeof data.rotation === "number" ? data.rotation : 0;
	return (
		<div
			style={{
				position: "absolute",
				left: data.x,
				top: data.y,
				width: data.width,
				height: data.height,
				fontSize: data.fontSize ?? 16,
				fontFamily: data.fontFamily ?? "system-ui, sans-serif",
				color,
				overflow: "hidden",
				whiteSpace: "nowrap",
				textOverflow: "ellipsis",
				pointerEvents: "none",
				transform: rotation ? `rotate(${rotation}deg)` : undefined,
				transformOrigin: "center center",
			}}
		>
			{text}
		</div>
	);
}

// ── Shape Definition ──

const textStyle = (data: TextShapeData): React.CSSProperties => ({
	width: "100%",
	height: "100%",
	whiteSpace: "pre-wrap",
	wordBreak: "break-word",
	outline: "none",
	fontFamily: data.fontFamily ?? "system-ui, sans-serif",
	fontSize: data.fontSize ?? 16,
	color: data.style.stroke,
	background: data.style.fill === "transparent" ? "transparent" : data.style.fill,
	lineHeight: 1.4,
	padding: 4,
	boxSizing: "border-box",
});

function render(shape: ShapeData) {
	const data = shape as TextShapeData;
	if (!data.isEditing) {
		return (
			<div style={{ ...textStyle(data), pointerEvents: "none", userSelect: "none" }}>
				{data.text ?? ""}
			</div>
		);
	}

	return (
		// biome-ignore lint/a11y/useSemanticElements: contentEditable div is standard for rich text editing
		<div
			{...editableTextProps(data.id, data.text ?? "")}
			style={{ ...textStyle(data), cursor: "text", pointerEvents: "auto", userSelect: "auto" }}
		/>
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
	return { ...data, x, y, width: Math.max(40, width), height: Math.max(24, height) };
}

function createDefault(params: { id: string; x: number; y: number }): TextShapeData {
	return {
		id: params.id,
		type: "text",
		x: params.x,
		y: params.y,
		width: 200,
		height: 28,
		style: { ...DEFAULT_STYLE, fill: "transparent", strokeWidth: 0 },
		text: "",
		fontSize: 16,
		fontFamily: "system-ui, sans-serif",
		isEditing: false,
	};
}

function serializeForAi(shape: ShapeData): Record<string, unknown> {
	const data = shape as TextShapeData;
	return { text: data.text, fontSize: data.fontSize };
}

function debugFields(shape: ShapeData): Record<string, unknown> {
	// Mirror the renderer's `??` fallbacks so the HUD shows the value the user
	// actually sees on the canvas, not a placeholder zero.
	const data = shape as TextShapeData;
	return {
		text: data.text ?? "",
		fontSize: data.fontSize ?? 16,
		fontFamily: data.fontFamily ?? "system-ui, sans-serif",
		isEditing: data.isEditing ?? false,
	};
}

// ── Icon ──

function TextIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<text
				x="10"
				y="15"
				textAnchor="middle"
				fontSize="14"
				fontWeight="bold"
				fill="currentColor"
				fontFamily="serif"
			>
				T
			</text>
		</svg>
	);
}

// ── Plugin ──

export function createTextPlugin(): UsketchPlugin {
	return {
		id: "usketch-plugin-shape-text",
		name: "テキスト",

		setup(ctx: PluginContext) {
			// Shared editable-text controller (machine + DOM/canvas wiring).
			const editor = createEditableTextController(ctx, {
				isEditableType: (type) => type === "text",
				hitTest,
				growHeight: true,
				minHeight: 28,
			});

			// ── Shape registration ──
			ctx.shapes.register("text", {
				render,
				getBounds,
				hitTest: withRotation(hitTest),
				resize,
				createDefault,
				renderTarget: "html",
				minSize: { width: 40, height: 24 },
				simplifiedComponent: SimplifiedText,
				serializeForAi,
				debugFields,
			});

			// ── Draw tool registration ──
			ctx.tools.register("text-draw", {
				icon: TextIcon,
				cursor: "text",
				shortcut: "t",
				order: 25,
				onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
					const id = generateId();
					const defaults = createDefault({ id, x: event.worldPoint.x, y: event.worldPoint.y });
					// Anchor: left-center (shift Y up by half height)
					const shape = { ...defaults, y: defaults.y - defaults.height / 2 };
					toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, shape));
					toolCtx.store.setSelection([id]);
					toolCtx.store.resetToDefaultTool();
					editor.beginEdit(id);
				},
				onPointerMove() {},
				onPointerUp() {},
			});

			// ── Teardown ──
			return () => {
				editor.teardown();
			};
		},
	};
}
