// Host-facing API of the croupier plugin, published on `ctx.services` (see
// docs/plugin-system-design.md). Every method is a thin binding of a table-ops
// function to the board store and the local player.
import { type BoardStore, defineService, generateId } from "@edv4h/usketch-shared";
import {
	claimHost,
	DEFAULT_TABLE_SIZE,
	dispatchAction,
	endGame,
	type GameRegistry,
	getTableView,
	joinTable,
	kickFromTable,
	leaveTable,
	listTables,
	makeTableShape,
	resetTable,
	setSeatNote,
	setTableOptions,
	startGame,
	takeOverTurn,
} from "./table-ops.js";
import type {
	CroupierGameDefinition,
	CroupierPlayer,
	GameOptions,
	OpResult,
	TableShape,
	TableView,
} from "./types.js";

export interface CroupierApi {
	/** The local player. */
	me(): CroupierPlayer;
	/** Games available on this board, in registration order. */
	games(): CroupierGameDefinition[];
	/**
	 * Create a table centered on a world point. `addShape` is the host's way to
	 * add it (default: `store.addShape`; pass an undoable command runner if wanted).
	 * Returns the new table id, or `null` for an unknown game.
	 */
	createTable(game: string, center: { x: number; y: number }, options?: GameOptions): string | null;
	/** Game used by the `croupier-table-draw` tool. Defaults to the first game. */
	getPendingGame(): string | undefined;
	setPendingGame(game: string): void;
	listTables(): TableShape[];
	/** The table as the local player sees it. Stable while nothing relevant changed. */
	getView(tableId: string): TableView | undefined;
	/** Fires on any change that may affect a table view (shapes or presence). */
	subscribe(listener: () => void): () => void;
	join(tableId: string): OpResult;
	leave(tableId: string): OpResult;
	kick(tableId: string, userId: string): OpResult;
	claimHost(tableId: string): OpResult;
	setOptions(tableId: string, options: GameOptions): OpResult;
	start(tableId: string): OpResult;
	dispatch(tableId: string, action: string, payload?: unknown): OpResult;
	/** Play the current turn with the game's bot (host only), for `players` or everyone due. */
	takeOver(tableId: string, players?: readonly string[]): Promise<OpResult>;
	endGame(tableId: string): OpResult;
	reset(tableId: string): OpResult;
	setNote(tableId: string, note: string): OpResult;
	/** Whether a player is connected (from the host's presence adapter; `true` without one). */
	isOnline(userId: string): boolean;
}

/** Typed service handle. Provided in `setup`; get it with `croupierService.get(ctx.services)`. */
export const croupierService = defineService<CroupierApi>("usketch-plugin-croupier");

export interface CroupierPresence {
	isOnline(userId: string): boolean;
	subscribe(listener: () => void): () => void;
}

export interface CreateCroupierApiParams {
	store: BoardStore;
	registry: GameRegistry;
	player: CroupierPlayer;
	presence?: CroupierPresence;
	now?: () => number;
	addShape?: (shape: TableShape) => void;
	tableSize?: { width: number; height: number };
}

/** The API plus the teardown of its store / presence subscriptions (called by the plugin). */
export type CroupierApiHandle = CroupierApi & { dispose(): void };

export function createCroupierApi(params: CreateCroupierApiParams): CroupierApiHandle {
	const { store, registry, player, presence } = params;
	const now = params.now ?? Date.now;
	const addShape = params.addShape ?? ((shape: TableShape) => store.addShape(shape));
	const tableSize = params.tableSize ?? DEFAULT_TABLE_SIZE;
	let pendingGame: string | undefined;

	// View cache: rebuilt only when the table, one of its seats or presence changed,
	// so `useSyncExternalStore` gets a stable snapshot.
	let presenceVersion = 0;
	const cache = new Map<string, { key: unknown[]; view: TableView | undefined }>();
	const keyFor = (tableId: string): unknown[] => {
		const shapes = store.getShapes();
		const key: unknown[] = [presenceVersion, shapes.get(tableId)];
		for (const shape of shapes.values()) {
			if (shape.parentId === tableId) key.push(shape);
		}
		return key;
	};
	const sameKey = (a: unknown[], b: unknown[]) =>
		a.length === b.length && a.every((v, i) => v === b[i]);

	const listeners = new Set<() => void>();
	const notify = () => {
		for (const listener of listeners) listener();
	};
	let lastShapes = store.getShapes();
	const offStore = store.subscribe(() => {
		const shapes = store.getShapes();
		if (shapes === lastShapes) return; // pan / zoom / selection only
		lastShapes = shapes;
		notify();
	});
	const offPresence = presence?.subscribe(() => {
		presenceVersion++;
		notify();
	});

	return {
		dispose() {
			offStore();
			offPresence?.();
			listeners.clear();
			cache.clear();
		},
		me: () => player,
		games: () => [...registry.values()],
		createTable(game, center, options) {
			if (!registry.has(game)) return null;
			const id = generateId();
			addShape(
				makeTableShape(registry, {
					id,
					game,
					x: center.x - tableSize.width / 2,
					y: center.y - tableSize.height / 2,
					host: player,
					options,
					size: tableSize,
				}),
			);
			return id;
		},
		getPendingGame: () => pendingGame ?? registry.keys().next().value,
		setPendingGame(game) {
			pendingGame = game;
		},
		listTables: () => listTables(store),
		getView(tableId) {
			const key = keyFor(tableId);
			const hit = cache.get(tableId);
			if (hit && sameKey(hit.key, key)) return hit.view;
			const view = getTableView(store, registry, tableId, player.userId);
			// Drop entries of deleted tables so the cache does not grow with the board's history.
			if (view) cache.set(tableId, { key, view });
			else cache.delete(tableId);
			return view;
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		join: (tableId) => joinTable(store, registry, tableId, player, now()),
		leave: (tableId) => leaveTable(store, tableId, player.userId),
		kick: (tableId, userId) => kickFromTable(store, tableId, player.userId, userId),
		claimHost(tableId) {
			const table = store.getShape(tableId) as TableShape | undefined;
			const hostAway = table ? !(presence?.isOnline(table.meta.hostUserId) ?? true) : false;
			return claimHost(store, tableId, player.userId, hostAway);
		},
		setOptions: (tableId, options) => setTableOptions(store, tableId, player.userId, options),
		start: (tableId) => startGame(store, registry, tableId, player.userId, now()),
		dispatch: (tableId, action, payload) =>
			dispatchAction(store, registry, tableId, player.userId, action, payload, now()),
		takeOver: (tableId, players) =>
			takeOverTurn(store, registry, tableId, player.userId, now, players),
		endGame: (tableId) => endGame(store, registry, tableId, player.userId, now()),
		reset: (tableId) => resetTable(store, tableId, player.userId),
		setNote: (tableId, note) => setSeatNote(store, tableId, player.userId, note),
		isOnline: (userId) => presence?.isOnline(userId) ?? true,
	};
}
