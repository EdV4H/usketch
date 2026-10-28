import type { ShapeData } from "@edv4h/usketch-shared";

/** Frame shape extension: intrinsic data for the `frame` shape. */
export interface FrameShapeData extends ShapeData {
	frameTitle?: string;
	name?: string;
}
