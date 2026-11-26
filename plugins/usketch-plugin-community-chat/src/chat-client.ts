import type { ChatMessage } from "./types.js";

/** チャットを分けるページ。 */
export interface ChatPageScope {
	id: string;
	/** ページを使う前に書かれたメッセージ（ページの無いもの）も含める。 */
	includeUnpaged?: boolean;
}

export interface ChatClientOptions {
	apiUrl: string;
	extraHeaders?: Record<string, string>;
	/** 今のページ（ページを使うボード）。 */
	page?: ChatPageScope;
}

export function createChatClient(options: ChatClientOptions) {
	const { apiUrl, extraHeaders, page } = options;

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
			if (page) {
				params.set("pageId", page.id);
				if (page.includeUnpaged) params.set("includeUnpaged", "1");
			}
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
				body: JSON.stringify({
					text,
					authorName,
					threadId,
					...(page ? { pageId: page.id } : {}),
				}),
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
