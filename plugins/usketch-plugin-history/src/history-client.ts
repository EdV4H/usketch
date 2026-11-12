// HTTP client for the board history API served by the board server
// (`/api/boards/:boardId/history`). Response types mirror
// apps/server/src/rooms/history-manager.ts.
import type { HistoryCommit, ShapeData, ShapeFieldChange } from "@edv4h/usketch-shared";

/** One row of the commit list. Shape bodies are not included. */
export interface HistoryCommitSummary extends HistoryCommit {
	hash: string;
	shapeCount: number;
	/** Changes from the first parent. The first commit counts every shape as added. */
	stats: { added: number; removed: number; modified: number };
}

export interface HistoryCommitPage {
	head: string | null;
	commits: HistoryCommitSummary[];
	/** Pass as `cursor` to get the next (older) page; `null` when there is none. */
	nextCursor: string | null;
}

export interface HistoryCommitDetail {
	hash: string;
	commit: HistoryCommit;
	shapes: ShapeData[];
}

export interface HistoryShapeModification {
	id: string;
	before: ShapeData;
	after: ShapeData;
	changes: ShapeFieldChange[];
}

export interface HistoryDiff {
	from: string;
	/** A commit hash, or `"working"` for the current board. */
	to: string;
	added: ShapeData[];
	removed: ShapeData[];
	modified: HistoryShapeModification[];
}

export interface HistoryClientOptions {
	apiUrl: string;
	boardId: string;
	/** Extra request headers (e.g. the dev-mode `X-User-Id`). */
	extraHeaders?: Record<string, string>;
	/** Defaults to `globalThis.fetch`. */
	fetch?: typeof fetch;
}

/** A request the server answered with a non-2xx status. */
export class HistoryRequestError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "HistoryRequestError";
	}
}

export interface HistoryClient {
	listCommits(options?: { limit?: number; cursor?: string | null }): Promise<HistoryCommitPage>;
	getCommit(hash: string): Promise<HistoryCommitDetail>;
	/** Diff two commits; without `to`, diff `from` against the current board. */
	diff(from: string, to?: string): Promise<HistoryDiff>;
	/** Record the current board as a named version (made even when nothing changed). */
	createCommit(options?: {
		message?: string;
		trigger?: "manual" | "restore";
	}): Promise<HistoryCommitSummary>;
}

export function createHistoryClient(options: HistoryClientOptions): HistoryClient {
	const base = `${options.apiUrl}/api/boards/${encodeURIComponent(options.boardId)}/history`;
	const doFetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));

	async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
		const res = await doFetch(`${base}${path}`, {
			...init,
			credentials: "include",
			headers: {
				...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
				...options.extraHeaders,
			},
		});
		if (!res.ok) {
			let message = `History request failed (${res.status})`;
			try {
				const body = (await res.json()) as { error?: unknown };
				if (typeof body.error === "string") message = body.error;
			} catch {
				// not JSON
			}
			throw new HistoryRequestError(res.status, message);
		}
		return (await res.json()) as T;
	}

	return {
		listCommits({ limit, cursor } = {}) {
			const params = new URLSearchParams();
			if (limit !== undefined) params.set("limit", String(limit));
			if (cursor) params.set("cursor", cursor);
			const query = params.toString();
			return request<HistoryCommitPage>(query ? `?${query}` : "");
		},
		getCommit(hash) {
			return request<HistoryCommitDetail>(`/commits/${encodeURIComponent(hash)}`);
		},
		diff(from, to) {
			const params = new URLSearchParams({ from });
			if (to) params.set("to", to);
			return request<HistoryDiff>(`/diff?${params.toString()}`);
		},
		async createCommit({ message, trigger } = {}) {
			const body = await request<{ commit: HistoryCommitSummary }>("/commits", {
				method: "POST",
				body: JSON.stringify({ message, trigger }),
			});
			return body.commit;
		},
	};
}
