const STORAGE_KEY = "usketch-local-boards";

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
};
