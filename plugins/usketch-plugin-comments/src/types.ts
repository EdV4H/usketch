export interface CommentMessage {
	id: string;
	commentId: string;
	authorId: string;
	text: string;
	createdAt: string;
}

export interface CommentThread {
	id: string;
	boardId: string;
	anchorShapeId: string;
	anchorX: number;
	anchorY: number;
	resolved: number;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
	messages: CommentMessage[];
}
