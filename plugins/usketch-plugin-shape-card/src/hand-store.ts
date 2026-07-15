/**
 * Client-local hand store (#671).
 *
 * A player's hand cards live **only here** — in this browser's memory, mirrored
 * to `localStorage`. Card contents are never written to the shared Yjs document
 * or broadcast over awareness, so other clients cannot read them (they only see
 * a count, shared separately via awareness). This is the interim privacy model;
 * the server-authoritative version is tracked in #686.
 */

/**
 * Minimal Yjs Awareness subset used to share hand **counts** (not contents).
 * The app injects a `wsProvider` exposing this (same shape as presence-cursor).
 */
export interface CardHandAwareness {
	setLocalStateField(field: string, value: unknown): void;
	getStates(): Map<number, Record<string, unknown>>;
	on(event: "change", cb: () => void): void;
	off(event: "change", cb: () => void): void;
	doc: { clientID: number };
}

/** A card removed from the board and held in hand. Enough to reconstruct the shape. */
export interface HandCardEntry {
	/** Original shape id (reused when the card is played back to the board). */
	id: string;
	cardType: string;
	fields: Record<string, unknown>;
	width: number;
	height: number;
}

type Listener = () => void;

function storageKey(boardId: string | undefined, userId: string): string {
	return `usketch:card-hand:${boardId ?? "local"}:${userId}`;
}

/** In-memory + localStorage backed hand for a single (board, user). */
export interface HandStore {
	getHand(): readonly HandCardEntry[];
	addToHand(entry: HandCardEntry): void;
	removeFromHand(id: string): HandCardEntry | undefined;
	subscribe(listener: Listener): () => void;
	/** Current card count (what gets shared via awareness). */
	count(): number;
}

/**
 * `localStorage` may be unavailable (SSR / node tests / privacy mode). Fall back
 * to a pure in-memory store so the hand still works within the session.
 */
function safeStorage(): Pick<Storage, "getItem" | "setItem"> | null {
	try {
		if (typeof localStorage === "undefined") return null;
		return localStorage;
	} catch {
		return null;
	}
}

export function createHandStore(userId: string, boardId?: string): HandStore {
	const key = storageKey(boardId, userId);
	const storage = safeStorage();
	const listeners = new Set<Listener>();

	let hand: HandCardEntry[] = load();

	function load(): HandCardEntry[] {
		if (!storage) return [];
		try {
			const raw = storage.getItem(key);
			if (!raw) return [];
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? (parsed as HandCardEntry[]) : [];
		} catch {
			return [];
		}
	}

	function persist() {
		if (!storage) return;
		try {
			storage.setItem(key, JSON.stringify(hand));
		} catch {
			// Quota / disabled storage — keep the in-memory copy, drop persistence.
		}
	}

	function notify() {
		for (const fn of listeners) fn();
	}

	return {
		getHand: () => hand,
		count: () => hand.length,
		addToHand(entry: HandCardEntry) {
			if (hand.some((e) => e.id === entry.id)) return;
			hand = [...hand, entry];
			persist();
			notify();
		},
		removeFromHand(id: string) {
			const entry = hand.find((e) => e.id === id);
			if (!entry) return undefined;
			hand = hand.filter((e) => e.id !== id);
			persist();
			notify();
			return entry;
		},
		subscribe(listener: Listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}
