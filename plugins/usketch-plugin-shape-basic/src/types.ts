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
	/** Horizontal text alignment. Undefined keeps the legacy "center". */
	textAlign?: "start" | "center" | "end";
	/** Vertical text alignment inside the shape. Undefined keeps the legacy "middle". */
	verticalAlign?: "start" | "middle" | "end";
	/** Undefined keeps the legacy "normal". */
	fontWeight?: "normal" | "bold";
	isEditing?: boolean;
}
