import type { ShapeData } from "@edv4h/usketch-shared";

/** Rectangle shape extension: intrinsic data for the `rectangle` shape. */
export interface RectangleShapeData extends ShapeData {
	cornerRadius?: number;
}
