export interface AiCompleteRequest {
	prompt: string;
	canvasContext: string;
	boardId: string;
	model?: string;
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
}
