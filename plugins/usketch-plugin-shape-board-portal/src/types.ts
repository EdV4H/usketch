import type { ShapeData } from "@edv4h/usketch-shared";

/** Board portal shape extension: intrinsic data for the `board-portal` shape. */
export interface BoardPortalShapeData extends ShapeData {
	boardId: string;
	boardTitle: string;
	ownerName: string;
	ownerImage: string;
	memberCount: number;
	isPublic: boolean;
}
