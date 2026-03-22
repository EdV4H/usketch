export interface CopilotSuggestion {
	id: string;
	type: string;
	x: number;
	y: number;
	width: number;
	height: number;
	text?: string;
	style?: {
		fill?: string;
		stroke?: string;
		strokeWidth?: number;
		opacity?: number;
	};
}

export interface CopilotOptions {
	apiUrl: string;
	boardId: string;
	extraHeaders?: Record<string, string>;
	debounceMs?: number; // default 2000
	maxSuggestions?: number; // default 3
	enabled?: boolean; // default true
}
