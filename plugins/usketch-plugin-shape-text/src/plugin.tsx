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
import { createTextEditingService } from "./text-editing-machine.js";

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

function focusAtEnd(el: HTMLElement) {
	el.focus();
	const sel = window.getSelection();
	if (sel) {
		const range = document.createRange();
		range.selectNodeContents(el);
		range.collapse(false);
		sel.removeAllRanges();
		sel.addRange(range);
	}
}

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
			contentEditable="plaintext-only"
			suppressContentEditableWarning
			role="textbox"
			aria-multiline="true"
			tabIndex={0}
			ref={(el: HTMLDivElement | null) => {
				if (!el) return;
				// Only set text + focus once when first entering edit mode.
				// After that, the DOM owns the text content — React must NOT
				// replace it, or the cursor position will be lost.
				if (el.dataset.focused) return;
				el.dataset.focused = "1";
				el.textContent = data.text ?? "";
				requestAnimationFrame(() => focusAtEnd(el));
			}}
			onInput={(e: React.FormEvent<HTMLDivElement>) => {
				// Skip store update during IME composition
				if ((e.nativeEvent as InputEvent).isComposing) return;
				const el = e.currentTarget;
				window.dispatchEvent(
					new CustomEvent("usketch:text-input", {
						detail: { id: data.id, text: el.innerText, scrollHeight: el.scrollHeight },
					}),
				);
			}}
			onCompositionEnd={(e: React.CompositionEvent<HTMLDivElement>) => {
				const el = e.currentTarget;
				window.dispatchEvent(
					new CustomEvent("usketch:text-input", {
						detail: { id: data.id, text: el.innerText, scrollHeight: el.scrollHeight },
					}),
				);
			}}
			onKeyDown={(e: React.KeyboardEvent) => {
				e.stopPropagation();
				// Ignore Escape during IME composition (let IME handle it)
				if (e.key === "Escape" && !e.nativeEvent.isComposing) {
					window.dispatchEvent(new CustomEvent("usketch:text-escape", { detail: { id: data.id } }));
				}
			}}
			onBlur={(e: React.FocusEvent<HTMLDivElement>) => {
				// Clear focused flag so next edit session re-initializes textContent + focus
				delete e.currentTarget.dataset.focused;
				window.dispatchEvent(new CustomEvent("usketch:text-blur", { detail: { id: data.id } }));
			}}
			onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
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
	// Return raw values; the caller drops `undefined` / `""` / `null` so absent
	// fields don't pollute the prompt. Avoid hard-coding default values here —
	// they belong with `createDefault()`, not duplicated in serialization.
	const data = shape as TextShapeData;
	return { text: data.text, fontSize: data.fontSize };
}

function debugFields(shape: ShapeData): Record<string, unknown> {
	const data = shape as TextShapeData;
	return {
		text: data.text,
		fontSize: data.fontSize,
		fontFamily: data.fontFamily,
		isEditing: data.isEditing,
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

export const textPlugin: UsketchPlugin = {
	id: "usketch-plugin-shape-text",
	name: "テキスト",

	setup(ctx: PluginContext) {
		// ── State Machine ──
		const service = createTextEditingService(ctx);
		const { send, matches, stop: stopMachine } = service;

		// ── CustomEvent listeners ──
		const onTextInput = (e: Event) => {
			const { id, text, scrollHeight } = (e as CustomEvent).detail;
			send({ type: "TEXT_INPUT", id, text, scrollHeight });
		};

		const onTextBlur = (e: Event) => {
			const { id } = (e as CustomEvent).detail;
			requestAnimationFrame(() => {
				send({ type: "TEXT_BLUR", id });
			});
		};

		const onTextEscape = (e: Event) => {
			const { id } = (e as CustomEvent).detail;
			send({ type: "TEXT_ESCAPE", id });
		};

		window.addEventListener("usketch:text-input", onTextInput);
		window.addEventListener("usketch:text-blur", onTextBlur);
		window.addEventListener("usketch:text-escape", onTextEscape);

		// ── Global pointerdown to exit edit mode on outside click ──
		const onWindowPointerDown = (e: PointerEvent) => {
			if (!matches("editing")) return;
			// If the click target is inside the editing contentEditable, ignore
			// e.target can be a Text node, so walk up to nearest Element
			const target = e.target instanceof Element ? e.target : (e.target as Node).parentElement;
			if (target?.closest("[contenteditable=true]")) return;
			send({ type: "OUTSIDE_CLICK" });
		};
		window.addEventListener("pointerdown", onWindowPointerDown, true);

		// ── Double-click detection via EventBus ──
		const offPointerDown = ctx.events.on<CanvasPointerEvent>("canvas:pointerdown", (event) => {
			// Find text shape under pointer
			const shapes = ctx.store.getShapes();
			let hitShapeId: string | null = null;
			for (const [id, shape] of shapes) {
				if (shape.type === "text" && hitTest(shape, event.worldPoint)) {
					hitShapeId = id;
				}
			}
			send({ type: "POINTER_DOWN", shapeId: hitShapeId });
		});

		// ── Selection change monitoring ──
		const unsubscribe = ctx.store.subscribe(() => {
			const editingShapeId = service.context.editingShapeId;
			if (!editingShapeId) return;
			const selection = ctx.store.getSelection();
			if (!selection.has(editingShapeId)) {
				send({ type: "DESELECTED" });
			}
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
				toolCtx.store.setActiveToolId("select");
				send({ type: "CREATE_SHAPE", shapeId: id });
			},
			onPointerMove() {},
			onPointerUp() {},
		});

		// ── Teardown ──
		(this as UsketchPlugin).teardown = () => {
			stopMachine();
			window.removeEventListener("usketch:text-input", onTextInput);
			window.removeEventListener("usketch:text-blur", onTextBlur);
			window.removeEventListener("usketch:text-escape", onTextEscape);
			window.removeEventListener("pointerdown", onWindowPointerDown, true);
			offPointerDown();
			unsubscribe();
		};
	},
};
