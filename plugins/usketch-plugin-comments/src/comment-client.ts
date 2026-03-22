import type { CommentMessage, CommentThread } from "./types.js";

export interface CommentClientOptions {
	apiUrl: string;
	boardId: string;
	extraHeaders?: Record<string, string>;
}

export function createCommentClient(options: CommentClientOptions) {
	const { apiUrl, boardId, extraHeaders } = options;
	const base = `${apiUrl}/api/boards/${boardId}/comments`;

	function jsonHeaders(): Record<string, string> {
		return {
			"Content-Type": "application/json",
			...extraHeaders,
		};
	}

	function baseHeaders(): Record<string, string> {
		return { ...extraHeaders };
	}

	async function list(): Promise<CommentThread[]> {
		try {
			const res = await fetch(base, { credentials: "include", headers: baseHeaders() });
			if (!res.ok) return [];
			return (await res.json()) as CommentThread[];
		} catch {
			return [];
		}
	}

	async function createThread(params: {
		anchorShapeId: string;
		anchorX?: number;
		anchorY?: number;
		text: string;
	}): Promise<CommentThread | null> {
		try {
			const res = await fetch(base, {
				method: "POST",
				credentials: "include",
				headers: jsonHeaders(),
				body: JSON.stringify(params),
			});
			if (!res.ok) return null;
			return (await res.json()) as CommentThread;
		} catch {
			return null;
		}
	}

	async function addMessage(commentId: string, text: string): Promise<CommentMessage | null> {
		try {
			const res = await fetch(`${base}/${commentId}/messages`, {
				method: "POST",
				credentials: "include",
				headers: jsonHeaders(),
				body: JSON.stringify({ text }),
			});
			if (!res.ok) return null;
			return (await res.json()) as CommentMessage;
		} catch {
			return null;
		}
	}

	async function resolve(commentId: string, resolved: boolean): Promise<boolean> {
		try {
			const res = await fetch(`${base}/${commentId}`, {
				method: "PATCH",
				credentials: "include",
				headers: jsonHeaders(),
				body: JSON.stringify({ resolved }),
			});
			return res.ok;
		} catch {
			return false;
		}
	}

	async function deleteThread(commentId: string): Promise<boolean> {
		try {
			const res = await fetch(`${base}/${commentId}`, {
				method: "DELETE",
				credentials: "include",
				headers: baseHeaders(),
			});
			return res.ok;
		} catch {
			return false;
		}
	}

	return { list, createThread, addMessage, resolve, deleteThread };
}

export type CommentClient = ReturnType<typeof createCommentClient>;
