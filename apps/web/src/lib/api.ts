import type {
	DemoBoardRole,
	DemoPageAccess,
	PageMemberRole,
} from "@edv4h/usketch-demo-permissions";
import { getDevUser, isDevMode } from "./dev-auth.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
	const headers = new Headers(init?.headers);
	if (init?.body) {
		headers.set("Content-Type", "application/json");
	}

	// DEV_MODE: X-User-Idヘッダーでサーバー側認証をバイパス
	if (isDevMode()) {
		const devUser = getDevUser();
		if (devUser) {
			headers.set("X-User-Id", devUser.id);
		}
	}

	const res = await fetch(`${API_URL}${path}`, {
		credentials: "include",
		...init,
		headers,
	});

	if (!res.ok) {
		throw new Error(`API error: ${res.status} ${res.statusText}`);
	}

	return res.json();
}

export interface Board {
	id: string;
	title: string;
	description: string;
	ownerId: string;
	createdAt: string;
	updatedAt: string;
	isPublic: boolean;
	role: string | null;
}

/** `GET /api/boards/:id/page-access`: 見ている人の役割と、見られるページの公開範囲。 */
export interface BoardPageAccess {
	viewer: { userId: string; boardRole: DemoBoardRole | null; boardPublic: boolean };
	/** 公開範囲を決めたページ（見られるものだけ）。無いページは既定の扱い。 */
	pages: Record<string, DemoPageAccess>;
	/** 非公開ページの本当の名前（ルート doc では伏せている。見られるページだけ）。 */
	names: Record<string, string>;
	/** 公開範囲があって、この人が見られないページ。 */
	hidden: string[];
	/** 招いた人の名前とメール（管理できるページに招いた人だけ）。 */
	people?: Record<string, { name: string; email: string }>;
}

export interface DiscoverBoard {
	id: string;
	title: string;
	description: string;
	ownerId: string;
	ownerName: string;
	ownerImage: string | null;
	createdAt: string;
	updatedAt: string;
}

export const api = {
	boards: {
		list: () => fetchApi<Board[]>("/api/boards"),
		discover: () => fetchApi<DiscoverBoard[]>("/api/boards/discover"),
		get: (id: string) => fetchApi<Board>(`/api/boards/${id}`),
		create: (title?: string) =>
			fetchApi<{ id: string; title: string; createdAt: string }>("/api/boards", {
				method: "POST",
				body: JSON.stringify({ title }),
			}),
		update: (id: string, data: { title?: string; isPublic?: boolean; description?: string }) =>
			fetchApi<{ ok: boolean }>(`/api/boards/${id}`, {
				method: "PATCH",
				body: JSON.stringify(data),
			}),
		delete: (id: string) =>
			fetchApi<{ ok: boolean }>(`/api/boards/${id}`, {
				method: "DELETE",
			}),
		members: (id: string) =>
			fetchApi<{ userId: string; role: string; name: string; image: string | null }[]>(
				`/api/boards/${id}/members`,
			),
		addMember: (id: string, email: string, role?: "editor" | "viewer") =>
			fetchApi<{ ok: boolean }>(`/api/boards/${id}/members`, {
				method: "POST",
				body: JSON.stringify({ email, role }),
			}),
		removeMember: (boardId: string, userId: string) =>
			fetchApi<{ ok: boolean }>(`/api/boards/${boardId}/members/${userId}`, {
				method: "DELETE",
			}),
		pageAccess: (id: string) => fetchApi<BoardPageAccess>(`/api/boards/${id}/page-access`),
		setPageAccess: (
			boardId: string,
			pageId: string,
			access: Pick<DemoPageAccess, "visibility" | "edit">,
		) =>
			fetchApi<DemoPageAccess>(`/api/boards/${boardId}/pages/${pageId}/access`, {
				method: "PUT",
				body: JSON.stringify(access),
			}),
		invitePageMember: (
			boardId: string,
			pageId: string,
			invite: { email: string; role: PageMemberRole },
		) =>
			fetchApi<{ userId: string; role: PageMemberRole }>(
				`/api/boards/${boardId}/pages/${pageId}/members`,
				{ method: "POST", body: JSON.stringify(invite) },
			),
		removePageMember: (boardId: string, pageId: string, userId: string) =>
			fetchApi<{ ok: true }>(
				`/api/boards/${boardId}/pages/${pageId}/members/${encodeURIComponent(userId)}`,
				{ method: "DELETE" },
			),
		renamePrivatePage: (boardId: string, pageId: string, name: string) =>
			fetchApi<{ pageId: string; name: string }>(`/api/boards/${boardId}/pages/${pageId}/name`, {
				method: "PUT",
				body: JSON.stringify({ name }),
			}),
		toggleShare: (id: string) =>
			fetchApi<{ isPublic: boolean }>(`/api/boards/${id}/share`, {
				method: "POST",
			}),
	},
};
