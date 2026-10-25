import type { BoardStore, Command, Point, ResizeHandle, ShapeData } from "@edv4h/usketch-shared";
import { createUpdateShapeCommand } from "@edv4h/usketch-store";

/**
 * Figma-style text sizing.
 *
 * - `autoWidth: true` — no wrapping; the width follows the longest line.
 * - `autoWidth: false` / absent — fixed width; text wraps inside it. Text shapes
 *   saved before auto width existed have no flag and stay fixed width.
 */

/** Smallest auto width, so an empty text still shows its caret. */
export const AUTO_WIDTH_MIN = 16;

/** Unwrapped box size (padding included) of `text` rendered in the given font. */
export type TextMeasurer = (input: { text: string; fontSize: number; fontFamily: string }) => {
	width: number;
	height: number;
};

type TextLike = ShapeData & {
	text?: string;
	fontSize?: number;
	fontFamily?: string;
	autoWidth?: boolean;
};

const HORIZONTAL_HANDLES: ReadonlySet<ResizeHandle> = new Set(["e", "w", "ne", "nw", "se", "sw"]);

/** Handles that change the width — dragging one turns auto width into fixed width. */
export function isHorizontalHandle(handle: ResizeHandle): boolean {
	return HORIZONTAL_HANDLES.has(handle);
}

/** Handles whose double-click returns the text to auto width. */
export function isSideHandle(handle: ResizeHandle): boolean {
	return handle === "e" || handle === "w";
}

function measureText(data: TextLike, text: string, measure: TextMeasurer) {
	return measure({
		text,
		fontSize: data.fontSize ?? 16,
		fontFamily: data.fontFamily ?? "system-ui, sans-serif",
	});
}

export function resizeText(data: ShapeData, handle: ResizeHandle, delta: Point): ShapeData {
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
	// n/s handles leave the width alone — don't let the min-width clamp widen a
	// narrow auto-width text (e.g. an empty one) as a side effect.
	if (isHorizontalHandle(handle)) width = Math.max(40, width);
	const resized = { ...data, x, y, width, height: Math.max(24, height) };
	// Only an actual width change turns auto width into fixed width; merely
	// grabbing a handle (or the first half of a double-click) must not.
	if ((data as TextLike).autoWidth && width !== data.width) {
		(resized as TextLike).autoWidth = false;
	}
	return resized;
}

/** Patch that returns the text to auto width, fitted to its content. */
export function computeAutoFitPatch(
	data: ShapeData,
	measure: TextMeasurer,
): { autoWidth: true; width: number; height: number } {
	const size = measureText(data as TextLike, (data as TextLike).text ?? "", measure);
	return {
		autoWidth: true,
		width: Math.max(AUTO_WIDTH_MIN, Math.ceil(size.width)),
		height: Math.ceil(size.height),
	};
}

/** Width patch applied while typing: auto-width text follows its content. */
export function fitTextOnInput(
	data: ShapeData,
	text: string,
	measure: TextMeasurer,
): { width: number } | null {
	if (!(data as TextLike).autoWidth) return null;
	const size = measureText(data as TextLike, text, measure);
	return { width: Math.max(AUTO_WIDTH_MIN, Math.ceil(size.width)) };
}

/**
 * Return a text shape to auto width and fit it to its content (the left edge
 * stays put). Returns the undoable command, or null when nothing would change.
 */
export function fitTextToContent(
	store: BoardStore,
	shapeId: string,
	measure: TextMeasurer,
): Command | null {
	const shape = store.getShape(shapeId) as TextLike | undefined;
	if (shape?.type !== "text") return null;
	const to = computeAutoFitPatch(shape, measure);
	const from = { autoWidth: shape.autoWidth, width: shape.width, height: shape.height };
	if (from.autoWidth === to.autoWidth && from.width === to.width && from.height === to.height) {
		return null;
	}
	return createUpdateShapeCommand(
		store,
		shapeId,
		from as Partial<ShapeData>,
		to as Partial<ShapeData>,
	);
}
