import { getActiveTimeoutMs } from "@edv4h/croupier-core";
import type { PluginContext, ShapeData, UsketchPlugin } from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";
import type { ReactElement } from "react";
import {
	type CroupierApiHandle,
	type CroupierPresence,
	createCroupierApi,
	croupierService,
} from "./croupier-service.js";
import { bindGameState, type GameStateStore, readGameState } from "./game-state.js";
import {
	DEFAULT_TABLE_SIZE,
	type GameRegistry,
	listSeats,
	listTables,
	repairScannedTables,
	scanTables,
} from "./table-ops.js";
import {
	type SeatRenderer,
	seatShapeDefinition,
	type TableRenderer,
	tableShapeDefinition,
} from "./table-shape.js";
import {
	CROUPIER_SEAT_TYPE,
	CROUPIER_TABLE_TYPE,
	type CroupierGameDefinition,
	type CroupierPlayer,
	type TableShape,
} from "./types.js";

export const CROUPIER_TABLE_TOOL_ID = "croupier-table-draw";

export interface CroupierPluginOptions {
	/**
	 * The local player. Pass a getter when the user is known only after the plugin is
	 * created (e.g. a session that loads after the board), so moves use the real id.
	 */
	player: CroupierPlayer | (() => CroupierPlayer);
	/** Games that can be played on this board. The first one is the default. */
	games: CroupierGameDefinition[];
	/**
	 * Who is connected, e.g. from the board's awareness. Enables playing for absent
	 * players and handing the host role over. Without it everyone counts as online.
	 */
	presence?: CroupierPresence;
	/**
	 * Where running games are kept. Default: the table shape's meta, which the board
	 * rewrites as a whole on every change (each drag frame included), so long games
	 * bloat the board's history. Pass `createMapGameState(doc.getMap("croupier"))`
	 * to keep them in a document map beside the shapes.
	 */
	gameState?: GameStateStore;
	/** Clock for turn timing. Use a shared server clock when the board has one. Default `Date.now`. */
	now?: () => number;
	/** Host look for the table. Defaults to {@link defaultRenderTable}. */
	renderTable?: TableRenderer;
	/** Host look for a seat. Defaults to {@link defaultRenderSeat}. */
	renderSeat?: SeatRenderer;
	/** Size of a new table. Default 720×480. */
	tableSize?: { width: number; height: number };
	/**
	 * Absent-player handling, run by the host's client: after `awayGraceMs` offline
	 * (or the game's own turn timeout) the host plays that turn with the game's bot,
	 * and an offline host is replaced by the first connected player. Default 20 s.
	 * Set `false` to disable.
	 */
	awayGraceMs?: number | false;
	/** Register the table placement tool. Default `true`. */
	tool?: boolean;
	/** Icon of the placement tool. */
	toolIcon?: () => ReactElement;
}

const WATCH_INTERVAL_MS = 2000;

function DefaultToolIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
			<rect
				x="2.5"
				y="5"
				width="15"
				height="10"
				rx="5"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<rect x="8" y="7.5" width="4" height="5" rx="0.8" fill="currentColor" />
		</svg>
	);
}

/**
 * Plays croupier (`@edv4h/croupier-core`) games on the board. A `croupier-table`
 * shape holds the game and its engine snapshot; each joined player gets a
 * `croupier-seat` child shape. The plugin knows no rules — games come from
 * {@link CroupierPluginOptions.games}. Operations are on the
 * {@link croupierService} (and the HUD actions call the same functions).
 */
export function createCroupierPlugin(options: CroupierPluginOptions): UsketchPlugin {
	return {
		id: "usketch-plugin-croupier",
		name: "クルーピエ",

		setup(ctx: PluginContext) {
			const registry: GameRegistry = new Map(options.games.map((g) => [g.id, g]));
			const now = options.now ?? Date.now;
			const tableSize = options.tableSize ?? DEFAULT_TABLE_SIZE;
			const unbindGameState = options.gameState
				? bindGameState(ctx.store, options.gameState)
				: () => {};
			const api: CroupierApiHandle = createCroupierApi({
				store: ctx.store,
				registry,
				player: options.player,
				presence: options.presence,
				gameState: options.gameState,
				now,
				tableSize,
				// Creating / removing a table is undoable like any shape.
				addShape: (shape) =>
					ctx.commands.execute(createAddShapeCommand(ctx.store, shape as ShapeData)),
			});
			const unprovide = croupierService.provide(ctx.services, api);

			ctx.shapes.register(
				CROUPIER_TABLE_TYPE,
				tableShapeDefinition({
					api,
					renderTable: options.renderTable,
					tableSize,
					defaultGame: () => api.getPendingGame(),
				}),
			);
			ctx.shapes.register(
				CROUPIER_SEAT_TYPE,
				seatShapeDefinition({ api, renderSeat: options.renderSeat }),
			);

			// ── Placement tool: click places a table of the pending game ──
			if (options.tool !== false) {
				ctx.tools.register(CROUPIER_TABLE_TOOL_ID, {
					icon: options.toolIcon ?? DefaultToolIcon,
					label: "ゲームテーブル",
					cursor: "crosshair",
					onPointerDown: (toolCtx, event) => {
						const game = api.getPendingGame();
						if (!game) return;
						const id = api.createTable(game, event.worldPoint);
						if (id) toolCtx.store.setSelection([id]);
						toolCtx.store.resetToDefaultTool();
					},
				});
			}

			// ── HUD actions (Controls → "Croupier") ──
			const selectedTable = (): TableShape | undefined => {
				for (const id of ctx.store.getSelection()) {
					const shape = ctx.store.getShape(id);
					if (shape?.type === CROUPIER_TABLE_TYPE) return shape as TableShape;
				}
				return undefined;
			};
			const viewOfSelected = () => {
				const table = selectedTable();
				return table ? api.getView(table.id) : undefined;
			};
			const offActions = [
				...options.games.map((game, i) =>
					ctx.actions.register({
						id: `croupier:new-table:${game.id}`,
						label: `${game.label} のテーブルを置く`,
						group: "Croupier",
						order: i,
						run: () => {
							const vp = ctx.store.getViewport();
							const center = {
								x: (window.innerWidth / 2 - vp.x) / vp.zoom,
								y: (window.innerHeight / 2 - vp.y) / vp.zoom,
							};
							const id = api.createTable(game.id, center);
							if (id) ctx.store.setSelection([id]);
						},
					}),
				),
				ctx.actions.register({
					id: "croupier:join",
					label: "選択中のテーブルに参加",
					group: "Croupier",
					order: 100,
					isEnabled: () => viewOfSelected()?.canJoin ?? false,
					run: () => {
						const table = selectedTable();
						if (table) api.join(table.id);
					},
				}),
				ctx.actions.register({
					id: "croupier:leave",
					label: "選択中のテーブルから抜ける",
					group: "Croupier",
					order: 101,
					isEnabled: () => {
						const view = viewOfSelected();
						return view?.phase === "lobby" && view.mySeat !== undefined;
					},
					run: () => {
						const table = selectedTable();
						if (table) api.leave(table.id);
					},
				}),
				ctx.actions.register({
					id: "croupier:start",
					label: "選択中のテーブルでスタート",
					group: "Croupier",
					order: 102,
					isEnabled: () => viewOfSelected()?.canStart ?? false,
					run: () => {
						const table = selectedTable();
						if (table) api.start(table.id);
					},
				}),
				ctx.actions.register({
					id: "croupier:reset",
					label: "選択中のテーブルをロビーに戻す",
					group: "Croupier",
					order: 103,
					isEnabled: () => {
						const view = viewOfSelected();
						return (view?.isHost ?? false) && view?.phase !== "lobby";
					},
					run: () => {
						const table = selectedTable();
						if (table) api.reset(table.id);
					},
				}),
			];

			// ── Housekeeping: reset copied tables, drop seats of deleted tables ──
			let lastShapes: ReturnType<typeof ctx.store.getShapes> | null = null;
			let seenTables = new Set<string>();
			const repair = () => {
				const shapes = ctx.store.getShapes();
				if (shapes === lastShapes) return;
				lastShapes = shapes;
				// One pass over the board per change (this runs on each frame of any drag).
				const scanned = scanTables(shapes);
				const tables = new Set(scanned.tables.map((t) => t.id));
				const removed = new Set<string>();
				for (const id of seenTables) {
					if (!tables.has(id)) removed.add(id);
				}
				seenTables = tables;
				repairScannedTables(ctx.store, scanned, removed);
			};
			const offRepair = ctx.store.subscribe(repair);
			repair();

			// ── Absent players (host's client only) ──
			const awayGraceMs = options.awayGraceMs;
			const grace = awayGraceMs === false ? Number.POSITIVE_INFINITY : (awayGraceMs ?? 20_000);
			const offlineSince = new Map<string, number>();
			const busy = new Set<string>();
			// Snapshot revision at which a takeover last failed, per table: retry only
			// once the game moved, instead of re-running the bot every tick.
			const failedRevision = new Map<string, number>();
			const watch = () => {
				const presence = options.presence;
				const t = now();
				const online = (userId: string) => presence?.isOnline(userId) ?? true;
				const awayFor = (userId: string) => {
					if (online(userId)) {
						offlineSince.delete(userId);
						return 0;
					}
					const since = offlineSince.get(userId) ?? t;
					offlineSince.set(userId, since);
					return t - since;
				};
				for (const table of listTables(ctx.store)) {
					const me = api.me().userId;
					const seats = listSeats(ctx.store, table.id);
					if (!seats.some((s) => s.meta.userId === me)) continue;
					// Host gone: the first connected player (in join order) takes over.
					if (table.meta.hostUserId !== me) {
						const host = table.meta.hostUserId;
						const hostGone = !seats.some((s) => s.meta.userId === host) || awayFor(host) >= grace;
						const firstOnline = seats.find((s) => online(s.meta.userId));
						if (hostGone && firstOnline?.meta.userId === me) api.claimHost(table.id);
						continue;
					}
					if (table.meta.phase !== "playing" || busy.has(table.id)) continue;
					const game = readGameState(ctx.store, table);
					const revision = game?.snapshot.revision;
					if (revision !== undefined && failedRevision.get(table.id) === revision) continue;
					const view = api.getView(table.id);
					if (!view || view.isMyTurn) continue;
					const def = registry.get(table.meta.game);
					const timeout = def
						? getActiveTimeoutMs(def.createConfig(table.meta.options), {
								phase: game?.snapshot.phase ?? "",
								stage: game?.snapshot.stage,
								currentPlayers: view.currentPlayers,
								players: seats.map((s) => s.meta.userId),
								finished: false,
							})
						: undefined;
					const timedOut =
						timeout !== undefined &&
						game?.turnStartedAt != null &&
						t - game.turnStartedAt >= timeout;
					const absent = view.currentPlayers.filter((p) => awayFor(p) >= grace);
					if (absent.length === 0 && !timedOut) continue;
					busy.add(table.id);
					// Play only for the absent players (several may be due at once); on a
					// turn timeout, for everyone still due.
					void api
						.takeOver(table.id, timedOut ? undefined : absent)
						.then((result) => {
							if (result.ok) failedRevision.delete(table.id);
							else if (revision !== undefined) failedRevision.set(table.id, revision);
						})
						.finally(() => busy.delete(table.id));
				}
			};
			const timer = awayGraceMs === false ? null : setInterval(watch, WATCH_INTERVAL_MS);

			return () => {
				if (timer) clearInterval(timer);
				offRepair();
				for (const off of offActions) off();
				unprovide();
				api.dispose();
				unbindGameState();
			};
		},
	};
}
