import type { ShapeData } from "@edv4h/usketch-shared";

export interface ChatMessage {
	id: string;
	boardId: string;
	threadId: string;
	authorId: string;
	authorName: string;
	text: string;
	createdAt: string;
}

/** chat-widget シェイプが subscribe する新着メッセージイベント */
export interface ChatNewMessageEvent {
	message: ChatMessage;
	/** このイベントは「現在アクティブなタブで受信/送信された」= unread に計上しない */
	fromActiveTab: boolean;
}

/**
 * Chat widget shape extension: intrinsic data for the `chat-widget` shape.
 */
export interface ChatWidgetShapeData extends ShapeData {
	chatLabel?: string;
	threadId?: string;
	unread?: number;
	lastMessage?: string;
	lastAuthor?: string;
	lastAuthorId?: string;
	lastMessageAt?: string;
}
