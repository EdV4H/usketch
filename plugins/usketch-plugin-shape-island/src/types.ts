import type { ShapeData } from "@edv4h/usketch-shared";

/** Island shape extension: intrinsic data for the `island` shape. */
export interface IslandShapeData extends ShapeData {
	islandColor?: string;
	islandTitle?: string;
	/** Transient flag set when the island has just merged into a group (used for animation). */
	_islandJustMerged?: boolean;
	/** Marker placed on `group` shapes that were auto-created by the island plugin. */
	_isIslandGroup?: boolean;
}
