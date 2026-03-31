import type { ChatMessage } from "./types.js";

export interface ChatClientOptions {
	apiUrl: string;
	extraHeaders?: Record<string, string>;
}

export function createChatClient(options: ChatClientOptions) {
	const { apiUrl, extraHeaders } = options;

	function jsonHeaders(): Record<string, string> {
		return {
			"Content-Type": "application/json",
			...extraHeaders,
		};
	}

	function baseHeaders(): Record<string, string> {
		return { ...extraHeaders };
	}

	async function list(threadId: string, limit = 50, before?: string): Promise<ChatMessage[]> {
		try {
			const params = new URLSearchParams({ limit: String(limit), threadId });
			if (before) params.set("before", before);
			const res = await fetch(`${apiUrl}?${params}`, {
				credentials: "include",
				headers: baseHeaders(),
			});
			if (!res.ok) return [];
			return (await res.json()) as ChatMessage[];
		} catch {
			return [];
		}
	}

	async function send(
		threadId: string,
		text: string,
		authorName: string,
	): Promise<ChatMessage | null> {
		try {
			const res = await fetch(apiUrl, {
				method: "POST",
				credentials: "include",
				headers: jsonHeaders(),
				body: JSON.stringify({ text, authorName, threadId }),
			});
			if (!res.ok) return null;
			return (await res.json()) as ChatMessage;
		} catch {
			return null;
		}
	}

	return { list, send };
}

export type ChatClient = ReturnType<typeof createChatClient>;
