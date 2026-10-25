import {
	type BoardStore,
	type BoundingBox,
	type Command,
	type Point,
	type ResizeHandle,
	type ShapeData,
	safeRotation,
} from "@edv4h/usketch-shared";
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

/**
 * Width changes smaller than this (world px) are hand jitter — e.g. the first
 * click of a handle double-click — and keep the width (and auto width) as is.
 */
export const WIDTH_JITTER = 2;

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
	// narrow auto-width text (e.g. an empty one) as a side effect. Neither does
	// a jitter-sized drag of a side handle.
	if (isHorizontalHandle(handle)) {
		if (Math.abs(width - data.width) < WIDTH_JITTER) {
			width = data.width;
			x = data.x;
		} else {
			width = Math.max(40, width);
		}
	}
	const resized = { ...data, x, y, width, height: Math.max(24, height) };
	// Only an actual width change turns auto width into fixed width; merely
	// grabbing a handle (or the first half of a double-click) must not.
	if ((data as TextLike).autoWidth && width !== data.width) {
		(resized as TextLike).autoWidth = false;
	}
	return resized;
}

/**
 * `ShapeDefinition.applyBounds` for multi-selection resize, which bypasses
 * `resize`: a real width change turns auto width into fixed width there too.
 */
export function applyTextBounds(data: ShapeData, bounds: BoundingBox): Partial<ShapeData> {
	const patch: Partial<TextLike> = { ...bounds };
	if ((data as TextLike).autoWidth && Math.abs(bounds.width - data.width) >= WIDTH_JITTER) {
		patch.autoWidth = false;
	}
	return patch;
}

/**
 * Position that keeps a rotated shape's top-left corner where it is when its
 * size changes to `width` × `height`. A shape rotates around its center, so a
 * new size alone would shift the visible left / top edges. Null when unrotated.
 */
export function keepTopLeft(data: ShapeData, width: number, height: number): Point | null {
	const rad = (safeRotation(data.rotation) * Math.PI) / 180;
	if (!rad) return null;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	const rotate = (u: number, v: number): Point => ({ x: u * cos - v * sin, y: u * sin + v * cos });
	const offset = rotate(-data.width / 2, -data.height / 2);
	const topLeft = {
		x: data.x + data.width / 2 + offset.x,
		y: data.y + data.height / 2 + offset.y,
	};
	const toCenter = rotate(width / 2, height / 2);
	return { x: topLeft.x + toCenter.x - width / 2, y: topLeft.y + toCenter.y - height / 2 };
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

/**
 * Geometry patch applied while typing. Auto-width text follows its content.
 * A rotated text keeps its top-left corner in place as it grows (`height` is
 * the height the editor is about to apply). Inside a container that lays out
 * its children (and so sets their width), the text switches to fixed width
 * instead of fighting the layout over the width.
 */
export function fitTextOnInput(
	data: ShapeData,
	text: string,
	measure: TextMeasurer,
	options: { height?: number; laidOut?: boolean } = {},
): Partial<TextLike> | null {
	const patch: Partial<TextLike> = {};
	let width = data.width;
	if ((data as TextLike).autoWidth) {
		if (options.laidOut) return { autoWidth: false };
		const size = measureText(data as TextLike, text, measure);
		width = Math.max(AUTO_WIDTH_MIN, Math.ceil(size.width));
		patch.width = width;
	}
	const position = keepTopLeft(data, width, options.height ?? data.height);
	if (position) Object.assign(patch, position);
	return Object.keys(patch).length > 0 ? patch : null;
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
