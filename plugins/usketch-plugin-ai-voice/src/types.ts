export interface VoiceOptions {
	boardId: string;
	lang?: string; // default "ja-JP"
}

export interface VoiceStatusEvent {
	status: "listening" | "processing" | "done" | "error" | "unsupported";
	transcript?: string;
	message?: string;
}
