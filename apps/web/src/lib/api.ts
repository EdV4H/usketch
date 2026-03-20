const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
	const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
	if (init?.body) {
		headers["Content-Type"] = "application/json";
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
	},
};
