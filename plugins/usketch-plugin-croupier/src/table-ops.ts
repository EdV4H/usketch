/**
 * Table operations as plain functions over a {@link BoardStore}. The HUD actions,
 * the default renderer and the host-facing service all call these.
 *
 * Sync model: a board shape is synced as one value (last writer wins), so each
 * kind of write is owned by one party —
 * - the table (`croupier-table`): the host in the lobby / on reset, and the player
 *   whose turn it is while playing (only one writer at a time);
 * - a seat (`croupier-seat`): the seated player (joining, leaving, the result note).
 * Joining therefore adds a shape instead of editing a shared list, so two players
 * joining at the same moment never drop each other.
 *
 * Game state is the engine's own snapshot (`CroupierCore#toSnapshot`). An action
 * restores the engine from the table, dispatches, and writes the new snapshot back.
 * Every client can read the snapshot (hidden information is only hidden by
 * `getPlayerView`), which is the accepted trade-off of a serverless board.
 */
import {
	type BotDecision,
	CroupierCore,
	type CroupierSnapshot,
	type PlayerId,
} from "@edv4h/croupier-core";
import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import {
	CROUPIER_SEAT_TYPE,
	CROUPIER_TABLE_TYPE,
	type CroupierGameDefinition,
	type CroupierPlayer,
	type GameOptions,
	type OpResult,
	type SeatMeta,
	type SeatShape,
	type TableMeta,
	type TableShape,
	type TableView,
} from "./types.js";

export const DEFAULT_TABLE_SIZE = { width: 720, height: 480 };
export const SEAT_SIZE = { width: 128, height: 56 };
const SEAT_GAP = 8;
const SEAT_PADDING = 12;
const DEFAULT_MIN_PLAYERS = 2;
const DEFAULT_MAX_PLAYERS = 8;
/** Log entries kept in the snapshot (the table is rewritten every action, so keep it small). */
export const SNAPSHOT_LOG_LIMIT = 30;
/** Upper bound of bot actions in one takeover (one turn). */
const MAX_BOT_STEPS = 10;

export type GameRegistry = ReadonlyMap<string, CroupierGameDefinition>;

const ok: OpResult = { ok: true };
const fail = (error: string): OpResult => ({ ok: false, error });

// ── Readers ──

export function isTable(shape: ShapeData | undefined): shape is TableShape {
	return shape?.type === CROUPIER_TABLE_TYPE && typeof shape.meta === "object";
}

export function isSeat(shape: ShapeData | undefined): shape is SeatShape {
	return (
		shape?.type === CROUPIER_SEAT_TYPE &&
		typeof shape.meta === "object" &&
		typeof shape.parentId === "string"
	);
}

export function getTable(store: BoardStore, tableId: string): TableShape | undefined {
	const shape = store.getShape(tableId);
	return isTable(shape) ? shape : undefined;
}

/** Seats of a table in join order (= turn order). */
export function listSeats(store: BoardStore, tableId: string): SeatShape[] {
	return [...store.getShapes().values()]
		.filter((s): s is SeatShape => isSeat(s) && s.parentId === tableId)
		.sort((a, b) => a.meta.joinedAt - b.meta.joinedAt || a.id.localeCompare(b.id));
}

export function listTables(store: BoardStore): TableShape[] {
	return [...store.getShapes().values()].filter(isTable);
}

/** Deterministic, so two tabs of the same user joining at once write the same seat. */
export function seatIdFor(tableId: string, userId: string): string {
	return `${tableId}-seat-${userId}`;
}

function limits(def: CroupierGameDefinition | undefined) {
	return {
		min: def?.minPlayers ?? DEFAULT_MIN_PLAYERS,
		max: def?.maxPlayers ?? DEFAULT_MAX_PLAYERS,
	};
}

// ── Engine ──

// Restored engines for read-only views, keyed by the snapshot object (a store
// update replaces it, so a stale entry is never reused).
const viewEngines = new WeakMap<CroupierSnapshot, CroupierCore>();

function restore(def: CroupierGameDefinition, meta: TableMeta): CroupierCore | null {
	if (!meta.snapshot) return null;
	try {
		return CroupierCore.fromSnapshot(def.createConfig(meta.options), meta.snapshot);
	} catch {
		// A snapshot from an incompatible game version: show the table, refuse actions.
		return null;
	}
}

function viewEngine(def: CroupierGameDefinition, meta: TableMeta): CroupierCore | null {
	const snapshot = meta.snapshot;
	if (!snapshot) return null;
	const cached = viewEngines.get(snapshot);
	if (cached) return cached;
	const engine = restore(def, meta);
	if (engine) viewEngines.set(snapshot, engine);
	return engine;
}

function currentPlayersOf(engine: CroupierCore): PlayerId[] {
	const current = engine.getEngineState().currentPlayers;
	return Array.isArray(current) ? current : [current];
}

function allowedActionsOf(engine: CroupierCore): string[] {
	const { phase, stage } = engine.getEngineState();
	const phaseConfig = engine.getConfig().phases[phase];
	if (!phaseConfig) return [];
	const stageActions = stage ? phaseConfig.stages?.[stage]?.allowedActions : undefined;
	return stageActions ?? phaseConfig.allowedActions ?? [];
}

function writeSnapshot(store: BoardStore, table: TableShape, engine: CroupierCore, now: number) {
	const prev = table.meta.snapshot;
	const snapshot = engine.toSnapshot({ logLimit: SNAPSHOT_LOG_LIMIT });
	const before = prev ? currentKey(prev) : "";
	const turnChanged = currentKey(snapshot) !== before;
	const meta: TableMeta = {
		...table.meta,
		snapshot: snapshot as CroupierSnapshot,
		phase: snapshot.finished ? "finished" : "playing",
		turnStartedAt: turnChanged ? now : table.meta.turnStartedAt,
	};
	store.updateShape(table.id, { meta } as Partial<ShapeData>);
}

/** Identifies a turn: who is to act, in which phase (stages within a turn do not count). */
function currentKey(snapshot: CroupierSnapshot): string {
	return `${snapshot.currentPlayers.join(",")}|${snapshot.phase}`;
}

// ── Lobby ──

export interface CreateTableParams {
	id: string;
	game: string;
	/** Top-left of the table in world coordinates. */
	x: number;
	y: number;
	host: CroupierPlayer;
	options?: GameOptions;
	size?: { width: number; height: number };
}

export function makeTableShape(registry: GameRegistry, params: CreateTableParams): TableShape {
	const size = params.size ?? DEFAULT_TABLE_SIZE;
	const def = registry.get(params.game);
	const meta: TableMeta = {
		tableId: params.id,
		game: params.game,
		options: { ...(def?.defaultOptions ?? {}), ...(params.options ?? {}) },
		hostUserId: params.host.userId,
		phase: "lobby",
		snapshot: null,
		turnStartedAt: null,
	};
	return {
		id: params.id,
		type: CROUPIER_TABLE_TYPE,
		x: params.x,
		y: params.y,
		width: size.width,
		height: size.height,
		style: { fill: "#ffffff", stroke: "#1e1e1e", strokeWidth: 1, opacity: 1 },
		meta,
	} as TableShape;
}

/**
 * Place seats in a row along the inside bottom edge of the table. Only seats whose
 * geometry actually changes get a patch: every write is a sync, and the container
 * arrange step applies these patches on every table update (e.g. each action).
 */
export function layoutSeats(
	table: ShapeData,
	seats: readonly ShapeData[],
): Array<{ id: string; patch: Partial<ShapeData> }> {
	const step = SEAT_SIZE.width + SEAT_GAP;
	const rowWidth = seats.length * step - SEAT_GAP;
	const left = table.x + Math.max(SEAT_PADDING, (table.width - rowWidth) / 2);
	const y = table.y + table.height - SEAT_SIZE.height - SEAT_PADDING;
	const sorted = [...seats].sort(
		(a, b) =>
			((a.meta as Partial<SeatMeta>)?.joinedAt ?? 0) -
				((b.meta as Partial<SeatMeta>)?.joinedAt ?? 0) || a.id.localeCompare(b.id),
	);
	return sorted
		.map((seat, i) => ({
			seat,
			patch: { x: left + i * step, y, width: SEAT_SIZE.width, height: SEAT_SIZE.height },
		}))
		.filter(
			({ seat, patch }) =>
				seat.x !== patch.x ||
				seat.y !== patch.y ||
				seat.width !== patch.width ||
				seat.height !== patch.height,
		)
		.map(({ seat, patch }) => ({ id: seat.id, patch }));
}

function relayout(store: BoardStore, table: TableShape, onlyId?: string) {
	for (const { id, patch } of layoutSeats(table, listSeats(store, table.id))) {
		if (onlyId && id !== onlyId) continue;
		store.updateShape(id, patch);
	}
}

export function joinTable(
	store: BoardStore,
	registry: GameRegistry,
	tableId: string,
	player: CroupierPlayer,
	now: number,
): OpResult {
	const table = getTable(store, tableId);
	if (!table) return fail("Table not found");
	if (table.meta.phase !== "lobby") return fail("The game has already started");
	const seats = listSeats(store, tableId);
	if (seats.some((s) => s.meta.userId === player.userId)) return ok;
	if (seats.length >= limits(registry.get(table.meta.game)).max) return fail("The table is full");
	const meta: SeatMeta = {
		userId: player.userId,
		name: player.name,
		avatarUrl: player.avatarUrl,
		joinedAt: now,
	};
	const id = seatIdFor(tableId, player.userId);
	store.addShape({
		id,
		type: CROUPIER_SEAT_TYPE,
		parentId: tableId,
		x: table.x,
		y: table.y,
		width: SEAT_SIZE.width,
		height: SEAT_SIZE.height,
		style: { fill: "#ffffff", stroke: "#1e1e1e", strokeWidth: 1, opacity: 1 },
		meta,
	} as ShapeData);
	// Position only the new seat: other seats belong to other players.
	relayout(store, table, id);
	return ok;
}

/** Leave the lobby (removes the seat). While playing the seat stays so the game can go on. */
export function leaveTable(store: BoardStore, tableId: string, userId: string): OpResult {
	const table = getTable(store, tableId);
	if (!table) return fail("Table not found");
	const seat = listSeats(store, tableId).find((s) => s.meta.userId === userId);
	if (!seat) return ok;
	if (table.meta.phase !== "lobby") return fail("Players cannot leave a game in progress");
	store.deleteShape(seat.id);
	if (table.meta.hostUserId === userId) {
		const next = listSeats(store, tableId)[0];
		if (next) {
			store.updateShape(tableId, {
				meta: { ...table.meta, hostUserId: next.meta.userId },
			} as Partial<ShapeData>);
		}
	}
	return ok;
}

export function setTableOptions(
	store: BoardStore,
	tableId: string,
	actorId: string,
	options: GameOptions,
): OpResult {
	const table = getTable(store, tableId);
	if (!table) return fail("Table not found");
	if (table.meta.hostUserId !== actorId) return fail("Only the host can change the options");
	if (table.meta.phase !== "lobby") return fail("The game has already started");
	store.updateShape(tableId, {
		meta: { ...table.meta, options: { ...table.meta.options, ...options } },
	} as Partial<ShapeData>);
	return ok;
}

/** Remove a player (host only, lobby only). */
export function kickFromTable(
	store: BoardStore,
	tableId: string,
	actorId: string,
	userId: string,
): OpResult {
	const table = getTable(store, tableId);
	if (!table) return fail("Table not found");
	if (table.meta.hostUserId !== actorId) return fail("Only the host can remove players");
	if (userId === actorId) return fail("The host cannot remove themselves");
	return leaveTable(store, tableId, userId);
}

/**
 * Take over as host. Allowed for a seated player when the host has no seat, or
 * when `hostAway` is set (the caller decided the host is gone, e.g. from presence).
 */
export function claimHost(
	store: BoardStore,
	tableId: string,
	actorId: string,
	hostAway = false,
): OpResult {
	const table = getTable(store, tableId);
	if (!table) return fail("Table not found");
	if (table.meta.hostUserId === actorId) return ok;
	const seats = listSeats(store, tableId);
	if (!seats.some((s) => s.meta.userId === actorId)) return fail("Join the table first");
	const hostSeated = seats.some((s) => s.meta.userId === table.meta.hostUserId);
	if (hostSeated && !hostAway) return fail("The host is still here");
	store.updateShape(tableId, {
		meta: { ...table.meta, hostUserId: actorId },
	} as Partial<ShapeData>);
	return ok;
}

// ── Game ──

export function startGame(
	store: BoardStore,
	registry: GameRegistry,
	tableId: string,
	actorId: string,
	now: number,
	seed?: number,
): OpResult {
	const table = getTable(store, tableId);
	if (!table) return fail("Table not found");
	if (table.meta.hostUserId !== actorId) return fail("Only the host can start the game");
	if (table.meta.phase !== "lobby") return fail("The game has already started");
	const def = registry.get(table.meta.game);
	if (!def) return fail(`Unknown game "${table.meta.game}"`);
	const players = listSeats(store, tableId).map((s) => s.meta.userId);
	const { min, max } = limits(def);
	if (players.length < min) return fail(`At least ${min} players are needed`);
	if (players.length > max) return fail(`At most ${max} players can play`);
	const engine = new CroupierCore(def.createConfig(table.meta.options), players, { seed });
	writeSnapshot(store, table, engine, now);
	return ok;
}

export function dispatchAction(
	store: BoardStore,
	registry: GameRegistry,
	tableId: string,
	actorId: string,
	action: string,
	payload: unknown,
	now: number,
): OpResult {
	const table = getTable(store, tableId);
	if (!table) return fail("Table not found");
	if (table.meta.phase !== "playing") return fail("The game is not in progress");
	const def = registry.get(table.meta.game);
	if (!def) return fail(`Unknown game "${table.meta.game}"`);
	// Always restore a fresh engine: dispatch mutates it.
	const engine = restore(def, table.meta);
	if (!engine) return fail("The game state cannot be read");
	const result = engine.dispatch(actorId, action, payload);
	if (!result.ok) return fail(result.error ?? "Action rejected");
	writeSnapshot(store, table, engine, now);
	return ok;
}

/**
 * Play the current turn with the game's bot strategy (host only). `players`
 * limits it to those players (e.g. the absent ones in a game where several act
 * at once); by default it plays for everyone whose turn it is.
 */
export async function takeOverTurn(
	store: BoardStore,
	registry: GameRegistry,
	tableId: string,
	actorId: string,
	now: () => number,
	players?: readonly PlayerId[],
): Promise<OpResult> {
	const table = getTable(store, tableId);
	if (!table) return fail("Table not found");
	if (table.meta.hostUserId !== actorId) return fail("Only the host can play for others");
	if (table.meta.phase !== "playing") return fail("The game is not in progress");
	const def = registry.get(table.meta.game);
	if (!def) return fail(`Unknown game "${table.meta.game}"`);
	const engine = restore(def, table.meta);
	if (!engine) return fail("The game state cannot be read");
	const strategy = def.bot ?? engine.getConfig().bot;
	if (!strategy) return fail("This game has no bot strategy");
	const revision = engine.getRevision();
	const targets = new Set(players ?? currentPlayersOf(engine));
	// A turn can take several actions (e.g. draw, then discard): keep going while
	// a target player is still due and the bot makes progress.
	let acted = false;
	for (let step = 0; step < MAX_BOT_STEPS && !engine.getEngineState().finished; step++) {
		const due = currentPlayersOf(engine).filter((p) => targets.has(p));
		let progressed = false;
		for (const playerId of due) {
			const view = engine.getPlayerView(playerId);
			const state = engine.getEngineState();
			let decision: BotDecision | null;
			try {
				decision = await strategy.decide(playerId, view, state);
			} catch {
				decision = strategy.fallback?.(playerId, view, state) ?? null;
			}
			if (decision && engine.dispatch(playerId, decision.action, decision.payload).ok) {
				progressed = true;
			}
		}
		if (!progressed) break;
		acted = true;
	}
	if (!acted) return fail("The bot found nothing to do");
	// The bot may be async: drop the result if someone moved meanwhile.
	const latest = getTable(store, tableId);
	if (!latest || latest.meta.snapshot?.revision !== revision) return fail("The game moved on");
	writeSnapshot(store, latest, engine, now());
	return ok;
}

/** End the game now with the game's own result (host only). */
export function endGame(
	store: BoardStore,
	registry: GameRegistry,
	tableId: string,
	actorId: string,
	now: number,
): OpResult {
	const table = getTable(store, tableId);
	if (!table) return fail("Table not found");
	if (table.meta.hostUserId !== actorId) return fail("Only the host can end the game");
	if (table.meta.phase !== "playing") return fail("The game is not in progress");
	const def = registry.get(table.meta.game);
	if (!def) return fail(`Unknown game "${table.meta.game}"`);
	const engine = restore(def, table.meta);
	if (!engine) return fail("The game state cannot be read");
	engine.endSession();
	writeSnapshot(store, table, engine, now);
	return ok;
}

/** Back to the lobby with the same seats (host only). */
export function resetTable(store: BoardStore, tableId: string, actorId: string): OpResult {
	const table = getTable(store, tableId);
	if (!table) return fail("Table not found");
	if (table.meta.hostUserId !== actorId) return fail("Only the host can reset the table");
	store.updateShape(tableId, {
		meta: { ...table.meta, phase: "lobby", snapshot: null, turnStartedAt: null },
	} as Partial<ShapeData>);
	return ok;
}

/** Attach a note to the viewer's own seat (e.g. a reason shown with the result). */
export function setSeatNote(
	store: BoardStore,
	tableId: string,
	userId: string,
	note: string,
): OpResult {
	const seat = listSeats(store, tableId).find((s) => s.meta.userId === userId);
	if (!seat) return fail("Join the table first");
	store.updateShape(seat.id, { meta: { ...seat.meta, note } } as Partial<ShapeData>);
	return ok;
}

// ── Housekeeping ──

/**
 * Repair what copy/paste and deletion leave behind. Every client may run it on
 * each store change: it only writes values that every client computes alike.
 * - A copied table (its id differs from `meta.tableId`) becomes a fresh lobby
 *   with the same host, and seats copied along with it are removed.
 * - Seats of the tables in `removedTables` are removed. Pass only tables this
 *   client has seen and then lost: a seat that merely arrived before its table
 *   (board still loading, out-of-order sync) must not be taken for an orphan.
 */
export function repairTables(
	store: BoardStore,
	removedTables: ReadonlySet<string> = new Set(),
): void {
	const shapes = store.getShapes();
	const copied = new Set<string>();
	for (const shape of shapes.values()) {
		if (isTable(shape) && shape.meta.tableId !== shape.id) copied.add(shape.id);
	}
	for (const id of copied) {
		const table = shapes.get(id) as TableShape;
		store.updateShape(id, {
			meta: { ...table.meta, tableId: id, phase: "lobby", snapshot: null, turnStartedAt: null },
		} as Partial<ShapeData>);
	}
	for (const shape of [...shapes.values()]) {
		if (shape.type !== CROUPIER_SEAT_TYPE || typeof shape.parentId !== "string") continue;
		const parentId = shape.parentId;
		const removed = removedTables.has(parentId) && !shapes.has(parentId);
		const copiedSeat = copied.has(parentId);
		// Under an existing table, a seat whose id is not the deterministic one was
		// produced by a copy (even when the table itself was repaired earlier).
		const foreign =
			isTable(shapes.get(parentId)) &&
			isSeat(shape) &&
			shape.id !== seatIdFor(parentId, shape.meta.userId);
		if (removed || copiedSeat || foreign) store.deleteShape(shape.id);
	}
}

// ── View ──

export function getTableView(
	store: BoardStore,
	registry: GameRegistry,
	tableId: string,
	viewerId: string,
): TableView | undefined {
	const table = getTable(store, tableId);
	if (!table) return undefined;
	const def = registry.get(table.meta.game);
	const seats = listSeats(store, tableId);
	const mySeat = seats.find((s) => s.meta.userId === viewerId);
	const isHost = table.meta.hostUserId === viewerId;
	const { min, max } = limits(def);
	const engine = def ? viewEngine(def, table.meta) : null;
	const currentPlayers =
		engine && !engine.getEngineState().finished ? currentPlayersOf(engine) : [];
	const isMyTurn = currentPlayers.includes(viewerId);
	return {
		table,
		definition: def,
		phase: table.meta.phase,
		seats,
		mySeat,
		isHost,
		canJoin: table.meta.phase === "lobby" && !mySeat && seats.length < max,
		canStart:
			isHost &&
			table.meta.phase === "lobby" &&
			def !== undefined &&
			seats.length >= min &&
			seats.length <= max,
		gameView: engine ? engine.getPlayerView(viewerId) : null,
		currentPlayers,
		isMyTurn,
		stage: engine?.getEngineState().stage,
		allowedActions: engine && isMyTurn ? allowedActionsOf(engine) : [],
		// Only the final result: a live result may reveal hidden information.
		result: engine?.getEngineState().finished ? engine.getResult() : null,
		log: engine ? engine.getPlayerLog(viewerId) : [],
		revision: engine?.getRevision() ?? 0,
	};
}
