import type { ShapeData } from "@edv4h/usketch-shared";

/** Frame shape extension: intrinsic data for the `frame` shape. */
export interface FrameShapeData extends ShapeData {
	frameTitle?: string;
	name?: string;
	/**
	 * Whether deleting the frame also deletes the items inside it. `undefined`
	 * means `true` (the default); `false` keeps the items in place.
	 */
	deleteContents?: boolean;
}
