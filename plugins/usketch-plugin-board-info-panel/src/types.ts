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
