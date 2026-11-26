import type { ShapeData } from "@edv4h/usketch-shared";

/** Board portal shape extension: intrinsic data for the `board-portal` shape. */
export interface BoardPortalShapeData extends ShapeData {
	boardId: string;
	/** このボードのページへ行くゲートなら、行き先のページ（`boardId` より優先）。 */
	pageId?: string;
	boardTitle: string;
	ownerName: string;
	ownerImage: string;
	memberCount: number;
	isPublic: boolean;
}
