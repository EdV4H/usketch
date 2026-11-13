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
	/** マルチページ: コメントしたシェイプのあるページ（ページより前のコメントは無い）。 */
	pageId?: string | null;
	anchorX: number;
	anchorY: number;
	resolved: number;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
	messages: CommentMessage[];
}
