import type { ShapeData } from "@edv4h/usketch-shared";

/** Sticky shape extension: intrinsic data for the `sticky` shape. */
export interface StickyShapeData extends ShapeData {
	text: string;
	fontSize: number;
	stickyColor: string;
	color?: string;
	isEditing: boolean;
}
