export interface AiCompleteRequest {
	prompt: string;
	canvasContext: string;
	boardId: string;
	image?: string;
	model?: string;
	/** 書き込むページ（ページを使うボードで今開いているページ）。省略時はサーバーが先頭ページにする。 */
	pageId?: string;
}

export interface AiStatusEvent {
	status: "thinking" | "placing" | "done" | "error";
	shapeCount?: number;
	message?: string;
}

export interface AiResponseEvent {
	shapes: Array<{
		id: string;
		type: string;
		x: number;
		y: number;
		width: number;
		height: number;
	}>;
}

export interface AiRequestEvent {
	prompt: string;
	boardId: string;
	image?: string;
}

export type SmartActionType = "tidy" | "label" | "translate" | "custom";

export interface AiSmartActionRequestEvent {
	action: SmartActionType;
	selectedShapeIds: string[];
	boardId: string;
	targetLanguage?: string;
	customPrompt?: string;
}
