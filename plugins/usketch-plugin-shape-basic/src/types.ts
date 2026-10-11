import type { ShapeData } from "@edv4h/usketch-shared";

/** Rectangle shape extension: intrinsic data for the `rectangle` shape. */
export interface RectangleShapeData extends ShapeData {
	cornerRadius?: number;
}

/**
 * Optional editable label shared by the 2D geo shapes (rectangle/ellipse/…),
 * mirroring the sticky/text fields so the shared editable-text controller works.
 */
export interface GeoTextData {
	text?: string;
	fontSize?: number;
	isEditing?: boolean;
}

export type ArrowDirection = "right" | "left" | "up" | "down";

/** Arrow shape extension: which way the head points (unset = `"right"`, legacy). */
export interface ArrowShapeData extends ShapeData {
	direction?: ArrowDirection;
}
