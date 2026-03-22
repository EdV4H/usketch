export type SmartActionType = "tidy" | "label" | "translate";

export interface SmartActionRequestEvent {
	action: SmartActionType;
	selectedShapeIds: string[];
	boardId: string;
	targetLanguage?: string; // for translate action
}
