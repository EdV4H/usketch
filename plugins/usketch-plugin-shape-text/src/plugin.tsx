import { createEditableTextController, editableTextProps } from "@edv4h/usketch-shape-utils";
import {
	type BoundingBox,
	type CanvasPointerEvent,
	DEFAULT_STYLE,
	generateId,
	type PluginContext,
	type Point,
	type ShapeData,
	type ToolContext,
	type UsketchPlugin,
	withRotation,
} from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";
import { createDomTextMeasurer } from "./dom-text-measurer.js";
import {
	AUTO_WIDTH_MIN,
	fitTextOnInput,
	fitTextToContent,
	isSideHandle,
	resizeText,
} from "./text-sizing.js";

/** Text shape extension: intrinsic data for the `text` shape. */
export interface TextShapeData extends ShapeData {
	text: string;
	fontSize: number;
	fontFamily: string;
	isEditing: boolean;
	/**
	 * true: auto width (no wrapping, width follows the longest line).
	 * false / absent: fixed width (wraps). Texts saved before auto width
	 * existed have no flag and keep their fixed width.
	 */
	autoWidth?: boolean;
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
	// Auto width never wraps — the shape widens to the longest line instead.
	whiteSpace: data.autoWidth ? "pre" : "pre-wrap",
	wordBreak: data.autoWidth ? undefined : "break-word",
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
		autoWidth: data.autoWidth ?? false,
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
			const measurer = createDomTextMeasurer();

			// Shared editable-text controller (machine + DOM/canvas wiring).
			const editor = createEditableTextController(ctx, {
				isEditableType: (type) => type === "text",
				hitTest,
				growHeight: true,
				minHeight: 28,
				deleteWhenEmpty: true,
				fitOnInput: (shape, text) => fitTextOnInput(shape, text, measurer.measure),
			});

			// ── Shape registration ──
			ctx.shapes.register("text", {
				render,
				getBounds,
				hitTest: withRotation(hitTest),
				resize: resizeText,
				createDefault,
				renderTarget: "html",
				minSize: { width: 40, height: 24 },
				simplifiedComponent: SimplifiedText,
				serializeForAi,
				debugFields,
				onHandleDoubleClick(toolCtx, data, handle) {
					if (!isSideHandle(handle)) return false;
					const command = fitTextToContent(toolCtx.store, data.id, measurer.measure);
					if (command) toolCtx.commands.execute(command);
					// The canvas emits this pointer-down to the editor right after the
					// tool; without this it would also count as a double-click to edit.
					editor.cancelPendingClick();
					return true;
				},
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
					// Anchor: left-center (shift Y up by half height). New text starts
					// in auto width and grows to the right as the user types.
					const shape: TextShapeData = {
						...defaults,
						y: defaults.y - defaults.height / 2,
						autoWidth: true,
						width: AUTO_WIDTH_MIN,
					};
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
				measurer.dispose();
			};
		},
	};
}
