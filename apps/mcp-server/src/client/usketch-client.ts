/**
 * uSketch REST API クライアント
 * ボード管理の CRUD 操作を提供
 */
import type { McpConfig } from "../config.js";

export interface Board {
	id: string;
	title: string;
	ownerId: string;
	createdAt: string;
	updatedAt: string;
	isPublic: boolean;
	role: string | null;
}

export class UsketchClient {
	private readonly baseUrl: string;
	private readonly headers: Record<string, string>;

	constructor(config: McpConfig) {
		this.baseUrl = `${config.serverUrl}/api`;
		this.headers = {
			"Content-Type": "application/json",
			...(config.devMode ? { "X-User-Id": config.devUserId } : {}),
			...(config.apiToken ? { Authorization: `Bearer ${config.apiToken}` } : {}),
		};
	}

	private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
		const url = `${this.baseUrl}${path}`;
		const res = await fetch(url, {
			...options,
			headers: { ...this.headers, ...options.headers },
		});
		if (!res.ok) {
			const body = await res.text();
			throw new Error(`API error ${res.status}: ${body}`);
		}
		return res.json() as Promise<T>;
	}

	async listBoards(): Promise<Board[]> {
		return this.request<Board[]>("/boards");
	}

	async getBoard(boardId: string): Promise<Board> {
		return this.request<Board>(`/boards/${boardId}`);
	}

	async createBoard(title?: string): Promise<{ id: string; title: string; createdAt: string }> {
		return this.request("/boards", {
			method: "POST",
			body: JSON.stringify(title ? { title } : {}),
		});
	}

	async deleteBoard(boardId: string): Promise<{ ok: boolean }> {
		return this.request(`/boards/${boardId}`, { method: "DELETE" });
	}

	async updateBoard(
		boardId: string,
		data: { title?: string; isPublic?: boolean },
	): Promise<{ ok: boolean }> {
		return this.request(`/boards/${boardId}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		});
	}

	async toggleShare(boardId: string): Promise<{ isPublic: boolean }> {
		return this.request(`/boards/${boardId}/share`, { method: "POST" });
	}
}
