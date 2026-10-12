import { createAspectResize, createResize } from "@edv4h/usketch-shape-utils";
import type { Point, ResizeHandle, ShapeData } from "@edv4h/usketch-shared";
import { DEFAULT_IMAGE_RESIZE_MODE, type ImageResizeMode, type ImageShapeData } from "./types.js";

export const MIN_IMAGE_SIZE = 40;

function isValidRatio(n: unknown): n is number {
	return typeof n === "number" && Number.isFinite(n) && n > 0;
}

export function getImageResizeMode(data: ShapeData): ImageResizeMode {
	return (data as ImageShapeData).resizeMode ?? DEFAULT_IMAGE_RESIZE_MODE;
}

/**
 * Width / height ratio a `keep-aspect` image is locked to: the stored
 * `aspectRatio`, else the current box ratio, else `1`.
 */
export function getImageAspect(data: ShapeData): number {
	const stored = (data as ImageShapeData).aspectRatio;
	if (isValidRatio(stored)) return stored;
	const current = data.width / data.height;
	return isValidRatio(current) ? current : 1;
}

const freeResize = createResize(MIN_IMAGE_SIZE, MIN_IMAGE_SIZE);
const aspectResize = createAspectResize(getImageAspect, {
	minWidth: MIN_IMAGE_SIZE,
	minHeight: MIN_IMAGE_SIZE,
});

/**
 * `ShapeDefinition.resize` for images. `keep-aspect` locks the ratio on every
 * handle; `free` resizes width and height independently. In `keep-aspect`, an
 * image without a stored ratio gets one written from its pre-drag box, so a
 * flip later in the same drag (which zeroes the box) still keeps the ratio.
 */
export function resizeImageShape(data: ShapeData, handle: ResizeHandle, delta: Point): ShapeData {
	if (getImageResizeMode(data) === "free") return freeResize(data, handle, delta);
	const resized = aspectResize(data, handle, delta);
	if (isValidRatio((data as ImageShapeData).aspectRatio)) return resized;
	return { ...resized, aspectRatio: getImageAspect(data) } as ImageShapeData;
}
