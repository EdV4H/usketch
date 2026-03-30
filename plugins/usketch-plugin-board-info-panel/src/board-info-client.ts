import type { BoardInfo, BoardListItem, BoardMember } from "./types.js";

export interface BoardInfoClientOptions {
	apiUrl: string;
	extraHeaders?: Record<string, string>;
}

export function createBoardInfoClient(options: BoardInfoClientOptions) {
	const { apiUrl, extraHeaders } = options;

	async function fetchApi<T>(path: string): Promise<T> {
		const headers = new Headers(extraHeaders);
		const res = await fetch(`${apiUrl}${path}`, {
			credentials: "include",
			headers,
		});
		if (!res.ok) {
			throw new Error(`API error: ${res.status} ${res.statusText}`);
		}
		return res.json();
	}

	async function postApi<T>(path: string, method: string, body?: unknown): Promise<T> {
		const headers = new Headers(extraHeaders);
		if (body !== undefined) headers.set("Content-Type", "application/json");
		const res = await fetch(`${apiUrl}${path}`, {
			method,
			credentials: "include",
			headers,
			body: body !== undefined ? JSON.stringify(body) : undefined,
		});
		if (!res.ok) {
			throw new Error(`API error: ${res.status} ${res.statusText}`);
		}
		return res.json();
	}

	return {
		getBoard: (boardId: string) => fetchApi<BoardInfo>(`/api/boards/${boardId}`),
		getMembers: (boardId: string) => fetchApi<BoardMember[]>(`/api/boards/${boardId}/members`),
		listBoards: () => fetchApi<BoardListItem[]>("/api/boards"),
		deleteBoard: (boardId: string) => postApi<{ ok: boolean }>(`/api/boards/${boardId}`, "DELETE"),
		getThumbnailUrl: (boardId: string) =>
			`${apiUrl}/public/boards/${boardId}/thumbnail?w=240&h=160`,
	};
}

export type BoardInfoClient = ReturnType<typeof createBoardInfoClient>;
