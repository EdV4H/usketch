import type { ShapeData } from "@edv4h/usketch-shared";

/** Image shape extension: intrinsic data for the `image` shape. */
export interface ImageShapeData extends ShapeData {
	src: string;
}
