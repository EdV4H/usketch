export type SmartActionType = "tidy" | "label" | "translate" | "custom";

export interface SmartActionRequestEvent {
	action: SmartActionType;
	selectedShapeIds: string[];
	boardId: string;
	targetLanguage?: string;
	customPrompt?: string;
}
