import type {
	ActionLogEntry,
	BotStrategy,
	CroupierConfig,
	CroupierSnapshot,
	GameResult,
	GameState,
	PlayerId,
} from "@edv4h/croupier-core";
import type { ShapeData } from "@edv4h/usketch-shared";

/** Shape type of a game table (holds the game options, the host and the engine snapshot). */
export const CROUPIER_TABLE_TYPE = "croupier-table";
/** Shape type of a seat (one per joined player, child of a table). */
export const CROUPIER_SEAT_TYPE = "croupier-seat";
/** Every shape type this plugin owns (e.g. for a host that keeps game writes out of undo). */
export const CROUPIER_SHAPE_TYPES: readonly string[] = [CROUPIER_TABLE_TYPE, CROUPIER_SEAT_TYPE];

/** `lobby` → (host starts) → `playing` → (engine finishes) → `finished` → (host resets) → `lobby`. */
export type TablePhase = "lobby" | "playing" | "finished";

/** Game-specific options chosen in the lobby (e.g. a theme). Must be JSON-serializable. */
export type GameOptions = Record<string, unknown>;

/**
 * A game the host app makes available on the board. The plugin never knows the
 * rules: it builds a {@link CroupierConfig} from the table's options and drives it.
 */
export interface CroupierGameDefinition<S extends GameState = GameState> {
	/** Stable id stored on the table (`meta.game`). */
	id: string;
	/** Display name (HUD / default renderer). */
	label: string;
	/** Build the engine config for a table. Called on start and on every restore, so keep it pure. */
	createConfig(options: GameOptions): CroupierConfig<S>;
	/** Options of a new table. Default `{}`. */
	defaultOptions?: GameOptions;
	/** Players needed to start. Default 2. */
	minPlayers?: number;
	/** Seats available. Default 8. */
	maxPlayers?: number;
	/**
	 * Buttons of an action in the built-in look (e.g. one per card in hand for
	 * `discardCard`); an empty list hides the action. Without it, each allowed action is
	 * one button dispatched without a payload. Custom renderers can ignore it.
	 */
	actionChoices?(action: string, gameView: unknown, viewer: PlayerId): ActionChoice[];
	/** Strategy used when the host plays for an absent player. Defaults to `config.bot`. */
	bot?: BotStrategy<S>;
}

/** One button of the built-in look: dispatches `action` with `payload`. */
export interface ActionChoice {
	label: string;
	payload?: unknown;
}

/** `croupier-table` meta. Written by the host (lobby / start / reset) and the current player (actions). */
export type TableMeta = {
	/** Id the table was created with. A copy carries the source id, which is how copies are detected and reset. */
	tableId: string;
	game: string;
	options: GameOptions;
	hostUserId: string;
	phase: TablePhase;
	/** Engine state (`CroupierCore#toSnapshot`). `null` in the lobby. */
	snapshot: CroupierSnapshot | null;
	/** When the current turn started (host clock), for absent-player takeover. */
	turnStartedAt: number | null;
};

/** `croupier-seat` meta. Written by the seated player only (except kick / leave by the host). */
export type SeatMeta = {
	userId: string;
	name: string;
	avatarUrl?: string;
	joinedAt: number;
	/** Free text the player attaches to the result (e.g. why they kept these cards). */
	note?: string;
};

export type TableShape = ShapeData & { meta: TableMeta };
export type SeatShape = ShapeData & { meta: SeatMeta; parentId: string };

/** The local user. */
export interface CroupierPlayer {
	userId: string;
	name: string;
	avatarUrl?: string;
}

/** Everything a renderer needs about one table, from the viewer's point of view. */
export interface TableView {
	table: TableShape;
	definition: CroupierGameDefinition | undefined;
	phase: TablePhase;
	/** Seats in turn order (join order). */
	seats: SeatShape[];
	/** The viewer's seat, if joined. */
	mySeat: SeatShape | undefined;
	isHost: boolean;
	canJoin: boolean;
	canStart: boolean;
	/** `getPlayerView(viewer)` of the engine — other players' hidden info is already masked. `null` in the lobby. */
	gameView: unknown;
	/** Players whose turn it is. */
	currentPlayers: PlayerId[];
	isMyTurn: boolean;
	/** Current stage (e.g. `waitingForDraw`). */
	stage: string | undefined;
	/** Actions the viewer may dispatch now. */
	allowedActions: string[];
	result: GameResult | null;
	/** Most recent engine log entries (oldest first). */
	log: ActionLogEntry[];
	revision: number;
}

/** Result of a table operation. */
export type OpResult = { ok: true } | { ok: false; error: string };

/**
 * Erase a game's state type so games with different states fit in one list
 * (`games: [defineCroupierGame(a), defineCroupierGame(b)]`).
 */
export function defineCroupierGame<S extends GameState>(
	definition: CroupierGameDefinition<S>,
): CroupierGameDefinition {
	return definition as unknown as CroupierGameDefinition;
}
