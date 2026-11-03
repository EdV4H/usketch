import type { CroupierSnapshot } from "@edv4h/croupier-core";
import type { BoardStore } from "@edv4h/usketch-shared";
import type { TableShape } from "./types.js";

/** A table's running game: the engine snapshot and when the current turn started. */
export interface TableGameState {
	snapshot: CroupierSnapshot;
	/** When the current turn started (host clock), for absent-player takeover. */
	turnStartedAt: number | null;
}

/**
 * Where running games are kept, keyed by table id. Without one, the snapshot lives
 * in the table shape's meta, which the board rewrites as a whole on every change
 * (including each frame of a drag), so a long game bloats the board's history.
 * Keep it in a document map beside the shapes instead ({@link createMapGameState}).
 */
export interface GameStateStore {
	get(tableId: string): TableGameState | undefined;
	/** `null` removes the entry. */
	set(tableId: string, state: TableGameState | null): void;
	subscribe(listener: () => void): () => void;
}

/** The `Y.Map` subset {@link createMapGameState} uses. */
export interface GameStateMap {
	get(key: string): unknown;
	set(key: string, value: unknown): unknown;
	delete(key: string): void;
	observe(listener: () => void): void;
	unobserve(listener: () => void): void;
}

/** A {@link GameStateStore} over a synced map, e.g. `doc.getMap("croupier")`. */
export function createMapGameState(map: GameStateMap): GameStateStore {
	return {
		get(tableId) {
			const value = map.get(tableId) as TableGameState | undefined;
			return value && typeof value === "object" && value.snapshot ? value : undefined;
		},
		set(tableId, state) {
			if (state) map.set(tableId, state);
			else if (map.get(tableId) !== undefined) map.delete(tableId);
		},
		subscribe(listener) {
			const observer = () => listener();
			map.observe(observer);
			return () => map.unobserve(observer);
		},
	};
}

const bound = new WeakMap<BoardStore, GameStateStore>();

/**
 * Keep the running games of `store`'s tables in `gameState` instead of the table
 * meta. The plugin does this for its `gameState` option; call it yourself when you
 * use the table operations directly. Returns the unbind function.
 */
export function bindGameState(store: BoardStore, gameState: GameStateStore): () => void {
	bound.set(store, gameState);
	return () => {
		if (bound.get(store) === gameState) bound.delete(store);
	};
}

/** The store `store` is bound to, if any. */
export function boundGameState(store: BoardStore): GameStateStore | undefined {
	return bound.get(store);
}

/** The running game of a table, wherever it is kept. */
export function readGameState(store: BoardStore, table: TableShape): TableGameState | null {
	const gameState = bound.get(store);
	if (gameState) return gameState.get(table.id) ?? null;
	const { snapshot, turnStartedAt } = table.meta;
	return snapshot ? { snapshot, turnStartedAt } : null;
}

/** Store (or with `null`, clear) a table's game. Returns the meta fields to write on the table. */
export function writeGameState(
	store: BoardStore,
	table: TableShape,
	state: TableGameState | null,
): Pick<TableShape["meta"], "snapshot" | "turnStartedAt"> {
	const gameState = bound.get(store);
	if (gameState) {
		gameState.set(table.id, state);
		return { snapshot: null, turnStartedAt: null };
	}
	return { snapshot: state?.snapshot ?? null, turnStartedAt: state?.turnStartedAt ?? null };
}
