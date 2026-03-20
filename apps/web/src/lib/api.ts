const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
	const headers = new Headers(init?.headers);
	if (init?.body) {
		headers.set("Content-Type", "application/json");
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
	ownerId: string;
	createdAt: string;
	updatedAt: string;
	isPublic: boolean;
	role: string | null;
}

export const api = {
	boards: {
		list: () => fetchApi<Board[]>("/api/boards"),
		get: (id: string) => fetchApi<Board>(`/api/boards/${id}`),
		create: (title?: string) =>
			fetchApi<{ id: string; title: string; createdAt: string }>("/api/boards", {
				method: "POST",
				body: JSON.stringify({ title }),
			}),
		update: (id: string, data: { title?: string; isPublic?: boolean }) =>
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
		toggleShare: (id: string) =>
			fetchApi<{ isPublic: boolean }>(`/api/boards/${id}/share`, {
				method: "POST",
			}),
	},
};
