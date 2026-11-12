// Reactive state for the history panel (list / selection / diff / preview), as a
// plain store with subscribe + getState so the HUD panel, a host UI or a test can
// all drive the same logic. Every action here is a thin wrapper over
// history-ops.ts or the client.
import type { BoardStore, CommandRegistry, EventBus } from "@edv4h/usketch-shared";
import type {
	HistoryClient,
	HistoryCommitSummary,
	HistoryDiff,
	HistoryRequestError,
} from "./history-client.js";
import { enterPreview, exitPreview, restoreCommit, shortHash } from "./history-ops.js";

export interface HistoryState {
	commits: readonly HistoryCommitSummary[];
	head: string | null;
	nextCursor: string | null;
	/** A request is in flight (list, save, diff, preview or restore). */
	loading: boolean;
	error: string | null;
	/** The commit whose diff against the current board is shown. */
	selected: string | null;
	diff: HistoryDiff | null;
	/** The commit shown on the canvas instead of the live board. */
	previewing: string | null;
	/** Short note after a save / restore, for the panel to show. */
	notice: string | null;
}

export interface HistoryControllerDeps {
	client: HistoryClient;
	store: BoardStore;
	commands: CommandRegistry;
	events: EventBus;
	pageSize?: number;
}

export interface HistoryController {
	getState(): HistoryState;
	subscribe(listener: () => void): () => void;
	/** Reload the newest page of commits. */
	refresh(): Promise<void>;
	/** Append the next (older) page. */
	loadMore(): Promise<void>;
	/** Save the current board as a named version. */
	saveVersion(message?: string): Promise<HistoryCommitSummary | null>;
	/** Show what changed between a commit and the current board (null clears). */
	select(hash: string | null): Promise<void>;
	/** Show a commit on the canvas (read-only) until {@link exitPreview}. */
	preview(hash: string): Promise<void>;
	exitPreview(): void;
	/** Restore a commit (whole board, or only `ids`) as one undoable edit. */
	restore(hash: string, options?: { ids?: readonly string[] }): Promise<boolean>;
	/** Leave preview and drop listeners. */
	dispose(): void;
}

const INITIAL_STATE: HistoryState = {
	commits: [],
	head: null,
	nextCursor: null,
	loading: false,
	error: null,
	selected: null,
	diff: null,
	previewing: null,
	notice: null,
};

function errorMessage(err: unknown): string {
	if (err && typeof err === "object" && "status" in err) {
		const status = (err as HistoryRequestError).status;
		if (status === 403) return "この操作の権限がありません";
		if (status === 404) return "履歴が見つかりません";
	}
	return "履歴の読み込みに失敗しました";
}

export function createHistoryController(deps: HistoryControllerDeps): HistoryController {
	const pageSize = deps.pageSize ?? 30;
	let state: HistoryState = INITIAL_STATE;
	const listeners = new Set<() => void>();

	function set(patch: Partial<HistoryState>): void {
		state = { ...state, ...patch };
		for (const listener of listeners) listener();
	}

	/** Run one request with the shared loading / error flags. */
	async function run<T>(task: () => Promise<T>): Promise<T | undefined> {
		set({ loading: true, error: null, notice: null });
		try {
			const result = await task();
			set({ loading: false });
			return result;
		} catch (err) {
			set({ loading: false, error: errorMessage(err) });
			return undefined;
		}
	}

	async function refresh(): Promise<void> {
		await run(async () => {
			const page = await deps.client.listCommits({ limit: pageSize });
			set({ commits: page.commits, head: page.head, nextCursor: page.nextCursor });
		});
	}

	async function loadMore(): Promise<void> {
		const cursor = state.nextCursor;
		if (!cursor) return;
		await run(async () => {
			const page = await deps.client.listCommits({ limit: pageSize, cursor });
			set({ commits: [...state.commits, ...page.commits], nextCursor: page.nextCursor });
		});
	}

	async function saveVersion(message?: string): Promise<HistoryCommitSummary | null> {
		const saved = await run(async () => {
			const commit = await deps.client.createCommit({ message: message?.trim() || undefined });
			const page = await deps.client.listCommits({ limit: pageSize });
			set({ commits: page.commits, head: page.head, nextCursor: page.nextCursor });
			return commit;
		});
		if (saved) set({ notice: "版を保存しました" });
		return saved ?? null;
	}

	async function select(hash: string | null): Promise<void> {
		if (hash === null || hash === state.selected) {
			set({ selected: null, diff: null });
			return;
		}
		set({ selected: hash, diff: null });
		await run(async () => {
			const diff = await deps.client.diff(hash);
			// Ignore a late answer for a commit that is no longer selected.
			if (state.selected === hash) set({ diff });
		});
	}

	async function preview(hash: string): Promise<void> {
		await run(async () => {
			const detail = await deps.client.getCommit(hash);
			enterPreview(deps.events, detail.shapes);
			set({ previewing: hash });
		});
	}

	function leavePreview(): void {
		if (state.previewing === null) return;
		exitPreview(deps.events);
		set({ previewing: null });
	}

	async function restore(
		hash: string,
		options: { ids?: readonly string[] } = {},
	): Promise<boolean> {
		leavePreview();
		const result = await run(() =>
			restoreCommit(
				{ store: deps.store, commands: deps.commands, client: deps.client },
				hash,
				options,
			),
		);
		if (!result) return false;
		// Reload first: run() clears the notice set below.
		if (result.backup) await refresh();
		const changed = result.plan.add.length + result.plan.remove.length + result.plan.update.length;
		set({
			notice:
				changed === 0
					? "今のボードと同じなので何もしませんでした"
					: `${shortHash(hash)} に戻しました（${changed} 個のシェイプ、元に戻すで取り消せます）`,
			selected: null,
			diff: null,
		});
		return changed > 0;
	}

	return {
		getState: () => state,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		refresh,
		loadMore,
		saveVersion,
		select,
		preview,
		exitPreview: leavePreview,
		restore,
		dispose() {
			leavePreview();
			listeners.clear();
		},
	};
}
