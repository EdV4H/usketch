import type { ShapeData } from "@edv4h/usketch-shared";

/** How an image shape reacts to resize handles. */
export type ImageResizeMode = "keep-aspect" | "free";

/** How the bitmap fills the shape box (CSS `object-fit`). Matters only in `free` mode. */
export type ImageFit = "contain" | "cover" | "fill";

export const DEFAULT_IMAGE_RESIZE_MODE: ImageResizeMode = "keep-aspect";
export const DEFAULT_IMAGE_FIT: ImageFit = "contain";

/** Image shape extension: intrinsic data for the `image` shape. */
export interface ImageShapeData extends ShapeData {
	/**
	 * Inline source (data URL or external URL). Kept for backward compatibility
	 * and external links. New imports leave this empty and use {@link assetId}.
	 */
	src: string;
	/**
	 * Content-addressed asset id (resolved via the asset store). Preferred over
	 * `src`: duplicating the shape reuses the same asset (no data duplication).
	 */
	assetId?: string;
	/** Resize behavior. Absent = {@link DEFAULT_IMAGE_RESIZE_MODE}. */
	resizeMode?: ImageResizeMode;
	/** Bitmap fit inside the box. Absent = {@link DEFAULT_IMAGE_FIT}. */
	fit?: ImageFit;
	/**
	 * Locked width / height ratio used by `keep-aspect`. Set from the bitmap on
	 * import; absent on older shapes, which fall back to the current box ratio.
	 * Stored (rather than derived each time) because a resize that flips across
	 * the anchor edge zeroes the box width/height mid-drag.
	 */
	aspectRatio?: number;
}
