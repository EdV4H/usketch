const STORAGE_KEY = "usketch-local-boards";
/** お試しボード（`/try`）として開くローカルボードの id。 */
const TRY_BOARD_KEY = "usketch-try-board";

export interface LocalBoard {
	id: string;
	title: string;
	createdAt: string;
	updatedAt: string;
}

function load(): LocalBoard[] {
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
	} catch {
		return [];
	}
}

function save(boards: LocalBoard[]) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
}

export const localBoards = {
	list: (): LocalBoard[] => load(),

	create: (title = "Untitled"): LocalBoard => {
		const board: LocalBoard = {
			id: crypto.randomUUID(),
			title,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
		save([board, ...load()]);
		return board;
	},

	rename: (id: string, title: string) => {
		const boards = load().map((b) =>
			b.id === id ? { ...b, title, updatedAt: new Date().toISOString() } : b,
		);
		save(boards);
	},

	delete: (id: string) => {
		save(load().filter((b) => b.id !== id));
	},

	/**
	 * お試しボード（ログインなしで手元で試すローカルボード）を返す。無ければ作る。
	 * ブラウザごとに 1 つで、何度開いても同じボード。
	 */
	ensureTry: (): LocalBoard => {
		let id: string | null = null;
		try {
			id = localStorage.getItem(TRY_BOARD_KEY);
		} catch {}
		const existing = id ? load().find((b) => b.id === id) : undefined;
		if (existing) return existing;
		const board = localBoards.create("お試しボード");
		try {
			localStorage.setItem(TRY_BOARD_KEY, board.id);
		} catch {}
		return board;
	},
};
