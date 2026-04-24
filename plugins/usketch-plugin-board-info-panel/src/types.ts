import type { ShapeData } from "@edv4h/usketch-shared";

/**
 * board-portal shape extension: intrinsic data for the `board-portal` shape,
 * as observed/consumed by the board-info-panel plugin.
 */
export interface BoardPortalShapeData extends ShapeData {
	boardId?: string;
	boardTitle?: string;
	ownerName?: string;
	ownerImage?: string;
	memberCount?: number;
	isPublic?: boolean;
	thumbnailUrl?: string;
}

export interface BoardInfo {
	id: string;
	title: string;
	description: string;
	ownerId: string;
	createdAt: string;
	updatedAt: string;
	isPublic: boolean;
	role: string | null;
}

export interface BoardMember {
	userId: string;
	role: string;
	name: string;
	image: string | null;
	lastSeenAt: string | null;
	status: string;
}

export interface BoardListItem {
	id: string;
	title: string;
	ownerId: string;
	createdAt: string;
	updatedAt: string;
	isPublic: boolean;
	role: string | null;
}
