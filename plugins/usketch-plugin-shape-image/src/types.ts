import type { ShapeData } from "@edv4h/usketch-shared";

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
}
