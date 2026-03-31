export interface ChatMessage {
	id: string;
	boardId: string;
	threadId: string;
	authorId: string;
	authorName: string;
	text: string;
	createdAt: string;
}
