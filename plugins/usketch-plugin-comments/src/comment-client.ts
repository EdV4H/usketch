import type { CommentMessage, CommentThread } from "./types.js";

export interface CommentClientOptions {
	apiUrl: string;
	boardId: string;
	extraHeaders?: Record<string, string>;
}

export function createCommentClient(options: CommentClientOptions) {
	const { apiUrl, boardId, extraHeaders } = options;
	const base = `${apiUrl}/api/boards/${boardId}/comments`;

	function headers(extra?: Record<string, string>): Record<string, string> {
		return {
			"Content-Type": "application/json",
			...extraHeaders,
			...extra,
		};
	}

	async function list(): Promise<CommentThread[]> {
		const res = await fetch(base, { credentials: "include", headers: headers() });
		if (!res.ok) return [];
		return res.json() as Promise<CommentThread[]>;
	}

	async function createThread(params: {
		anchorShapeId: string;
		anchorX?: number;
		anchorY?: number;
		text: string;
	}): Promise<CommentThread | null> {
		const res = await fetch(base, {
			method: "POST",
			credentials: "include",
			headers: headers(),
			body: JSON.stringify(params),
		});
		if (!res.ok) return null;
		return res.json() as Promise<CommentThread>;
	}

	async function addMessage(commentId: string, text: string): Promise<CommentMessage | null> {
		const res = await fetch(`${base}/${commentId}/messages`, {
			method: "POST",
			credentials: "include",
			headers: headers(),
			body: JSON.stringify({ text }),
		});
		if (!res.ok) return null;
		return res.json() as Promise<CommentMessage>;
	}

	async function resolve(commentId: string, resolved: boolean): Promise<boolean> {
		const res = await fetch(`${base}/${commentId}`, {
			method: "PATCH",
			credentials: "include",
			headers: headers(),
			body: JSON.stringify({ resolved }),
		});
		return res.ok;
	}

	async function deleteThread(commentId: string): Promise<boolean> {
		const res = await fetch(`${base}/${commentId}`, {
			method: "DELETE",
			credentials: "include",
			headers: headers(),
		});
		return res.ok;
	}

	return { list, createThread, addMessage, resolve, deleteThread };
}

export type CommentClient = ReturnType<typeof createCommentClient>;
