import type { ClientSessionType, SessionAttachContext } from "@edv4h/usketch-plugin-session";
import type { SessionView } from "@edv4h/usketch-session-protocol";
import { type BoardStore, defineService, type ServiceRegistry } from "@edv4h/usketch-shared";
import {
	fitViewport,
	stayInRectConstraint,
	type ViewportSize,
	visibleWorldRect,
} from "./camera.js";
import {
	countdownRemainingMs,
	createGatherConfig,
	GATHER_TYPE,
	type GatherParticipation,
	type GatherPublic,
	type GatherRect,
	type GatherStartInput,
	type GatherTarget,
	gatherRemainingMs,
	initialParticipation,
	isGatherLive,
	parseGather,
} from "./gather.js";

export * from "./camera.js";
export * from "./gather.js";

/** How long the move to the place animates. */
const MOVE_MS = 700;

/** What the host UI shows: the running gathering and this client's place in it. */
export interface GatherState {
	/** The running gathering (the newest live one), or `null`. */
	session: SessionView | null;
	gather: GatherPublic | null;
	isHost: boolean;
	participation: GatherParticipation | null;
	/** Countdown left (ms) while `participation` is `countdown`. */
	countdownMs: number;
	/** Time-limit left (ms), or `null` without a limit. */
	remainingMs: number | null;
}

/** Host-facing API (`getGatherApi(app.services)`) for drawing the gathering UI. */
export interface GatherApi {
	getState(): GatherState;
	subscribe(listener: () => void): () => void;
	/**
	 * Start a gathering here (ends this client's own running one first).
	 * `stayPut`: the host is already looking at the place (started from their
	 * current view), so their camera is not moved.
	 */
	start(input: GatherStartInput, opts?: { stayPut?: boolean }): void;
	/** End the running gathering (host only). */
	end(): void;
	/** Step away (or skip the countdown). */
	leave(): void;
	/** Come back / go to the place again (also for the host). */
	rejoin(): void;
	/** Re-read the host's inputs (`canAutoMove`, the page) after they change. */
	refresh(): void;
	/** The place for "the selected shapes" or "what I'm looking at now". */
	resolveTarget(place: "selection" | "view"): GatherTarget | null;
}

export const gatherService = defineService<GatherApi>("usketch-session-gather");

export function getGatherApi(services: ServiceRegistry): GatherApi | undefined {
	return gatherService.get(services);
}

export interface GatherClientOptions {
	/** The canvas size (the element, not the window, when the host has side panels). */
	getViewportSize: () => ViewportSize | null;
	/** Whether the camera may be moved now (false while presenting, driving…). Default true. */
	canAutoMove?: () => boolean;
	/** Whether the board was opened through a deep link (read on the first attach only). */
	startAway?: () => boolean;
	/** Current page on a multi-page board, or null. */
	getPageId?: () => string | null;
	/** Go to another page (a new app is then attached and finishes the move). */
	switchPage?: (pageId: string) => void;
	/** A gathering this client saw is over. `byMe` when this client ended or replaced it. */
	onEnded?: (info: { gather: GatherPublic; byMe: boolean; timedOut: boolean }) => void;
	/** Priority for the load-time `viewport:claimed` (above start-position 10, below deep links 100). */
	claimPriority?: number;
	now?: () => number;
}

type Local = {
	id: string;
	participation: GatherParticipation;
	countdownEndsAt: number;
	/** Bumped by rejoin so the camera moves again while already joined. */
	moveSeq: number;
};

const shapeRect = (store: BoardStore, g: GatherPublic): GatherRect => {
	const id = g.target.shapeId;
	const shape = id ? store.getShape(id) : undefined;
	if (shape && shape.width > 0 && shape.height > 0) {
		return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
	}
	return g.target.rect;
};

const pickLive = (
	sessions: readonly SessionView[],
	now: number,
): { session: SessionView; gather: GatherPublic } | null => {
	let best: { session: SessionView; gather: GatherPublic } | null = null;
	for (const session of sessions) {
		if (session.type !== GATHER_TYPE) continue;
		const gather = parseGather(session.public);
		if (!gather || !isGatherLive(gather, now)) continue;
		if (!best || session.createdAt >= best.session.createdAt) best = { session, gather };
	}
	return best;
};

/**
 * The client half of `gather`. Create it **once per board visit** and pass it to
 * `createSessionPlugin({ types })`: what this person chose (stepped away, already
 * counted down) lives here, so it survives the host rebuilding the app (a page
 * switch). It has no HUD card; the host draws its UI with {@link getGatherApi}.
 */
export function createGatherClientType(options: GatherClientOptions): ClientSessionType {
	const now = options.now ?? Date.now;
	let local: Local | null = null;
	let firstAttach = true;
	let seenOnLoadId: string | null = null;
	let startAway = false;
	let endedByMe: { id: string; timedOut: boolean } | null = null;
	let stayPutPending = false;
	let lastSeen: { id: string; gather: GatherPublic } | null = null;

	const attach = (ctx: SessionAttachContext) => {
		const { client, userId, store } = ctx;
		const listeners = new Set<() => void>();
		const canAutoMove = () => options.canAutoMove?.() ?? true;
		let state: GatherState = {
			session: null,
			gather: null,
			isHost: false,
			participation: null,
			countdownMs: 0,
			remainingMs: null,
		};
		let tick: ReturnType<typeof setInterval> | null = null;
		let installTimer: ReturnType<typeof setTimeout> | null = null;
		let applied: string | null = null;
		let switchedFor: string | null = null;
		let disposed = false;

		const initial = pickLive(client.getState().sessions, now());
		if (firstAttach) {
			firstAttach = false;
			seenOnLoadId = initial?.session.id ?? null;
			startAway = options.startAway?.() ?? false;
		}
		// A move made while this app appears is instant: on load it must not race
		// other load-time cameras, after a page switch the page is brand new. Later
		// moves (a countdown ending, rejoining) animate.
		let instantNext = initial !== null;

		if (initial && !startAway) {
			queueMicrotask(() => {
				if (disposed) return;
				ctx.events.emit("viewport:claimed", {
					source: "session-gather",
					priority: options.claimPriority ?? 50,
				});
			});
		}

		const releaseCamera = () => {
			if (installTimer !== null) clearTimeout(installTimer);
			installTimer = null;
			store.setViewportConstraint(null);
		};

		const applyCamera = (live: { session: SessionView; gather: GatherPublic } | null) => {
			const key =
				live && local?.participation === "joined" ? `${live.session.id}:${local.moveSeq}` : null;
			if (key === applied) return;
			applied = key;
			releaseCamera();
			if (!live || !key) return;
			const { gather, session } = live;
			const page = options.getPageId?.() ?? null;
			if (gather.target.pageId && page && gather.target.pageId !== page) {
				switchedFor = session.id;
				options.switchPage?.(gather.target.pageId);
				return;
			}
			const instant = instantNext || switchedFor === session.id;
			instantNext = false;
			switchedFor = null;
			const isHost = session.hostUserId === userId;
			const stayPut = isHost && stayPutPending;
			stayPutPending = false;
			const size = options.getViewportSize();
			if (size && !stayPut) {
				const target = fitViewport(shapeRect(store, gather), size);
				if (instant) store.setViewport(target);
				else store.animateViewportTo(target, { durationMs: MOVE_MS });
			}
			if (gather.hold !== "stay" || isHost) return;
			const install = () => {
				installTimer = null;
				store.setViewportConstraint(
					stayInRectConstraint({
						getRect: () => {
							const cur = pickLive(client.getState().sessions, now());
							return cur ? shapeRect(store, cur.gather) : null;
						},
						getSize: options.getViewportSize,
					}),
				);
			};
			if (instant) install();
			else installTimer = setTimeout(install, MOVE_MS + 50);
		};

		const update = () => {
			if (disposed) return;
			const t = now();
			const sessions = client.getState().sessions;
			// Over by time: the host's client removes it; everyone else just ignores it.
			for (const s of sessions) {
				if (s.type !== GATHER_TYPE || s.hostUserId !== userId) continue;
				const g = parseGather(s.public);
				if (g && !isGatherLive(g, t)) {
					endedByMe = { id: s.id, timedOut: true };
					client.end(s.id);
					return; // the removal re-enters update
				}
			}
			const live = pickLive(sessions, t);
			if (lastSeen && lastSeen.id !== live?.session.id) {
				const mine = endedByMe?.id === lastSeen.id ? endedByMe : null;
				options.onEnded?.({
					gather: lastSeen.gather,
					byMe: mine !== null,
					timedOut: mine ? mine.timedOut : !isGatherLive(lastSeen.gather, t),
				});
			}
			lastSeen = live ? { id: live.session.id, gather: live.gather } : null;

			const isHost = live?.session.hostUserId === userId;
			if (!live) {
				local = null;
			} else if (local?.id !== live.session.id) {
				local = {
					id: live.session.id,
					participation: initialParticipation({
						isHost,
						canAutoMove: canAutoMove(),
						seenOnLoad: seenOnLoadId === live.session.id,
						startAway,
						gather: live.gather,
						now: t,
					}),
					countdownEndsAt: t + countdownRemainingMs(live.gather, t),
					moveSeq: 0,
				};
			} else if (local.participation === "countdown" && t >= local.countdownEndsAt) {
				local = { ...local, participation: canAutoMove() ? "joined" : "away" };
			} else if (local.participation !== "away" && !isHost && !canAutoMove()) {
				// Presenting / driving moves the camera itself; holding it would fight that.
				local = { ...local, participation: "away" };
			}

			applyCamera(live);

			const participation = local?.participation ?? null;
			state = {
				session: live?.session ?? null,
				gather: live?.gather ?? null,
				isHost,
				participation,
				countdownMs:
					participation === "countdown" && local ? Math.max(0, local.countdownEndsAt - t) : 0,
				remainingMs: live ? gatherRemainingMs(live.gather, t) : null,
			};
			const wantTick = live ? (participation === "countdown" ? 200 : 1000) : null;
			if (tick !== null) clearInterval(tick);
			tick = wantTick === null ? null : setInterval(update, wantTick);
			for (const l of listeners) l();
		};

		const offClient = client.subscribe(update);
		update();
		instantNext = false;

		const api: GatherApi = {
			getState: () => state,
			subscribe(listener) {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
			start(input, opts) {
				const mine = pickLive(client.getState().sessions, now());
				if (mine && mine.session.hostUserId === userId) {
					endedByMe = { id: mine.session.id, timedOut: false };
					client.end(mine.session.id);
				}
				stayPutPending = opts?.stayPut === true;
				const page = options.getPageId?.() ?? null;
				const target =
					page && !input.target.pageId ? { ...input.target, pageId: page } : input.target;
				client.create(createGatherConfig({ ...input, target }, now()));
			},
			end() {
				const live = pickLive(client.getState().sessions, now());
				if (!live || live.session.hostUserId !== userId) return;
				endedByMe = { id: live.session.id, timedOut: false };
				client.end(live.session.id);
			},
			leave() {
				if (!local) return;
				local = { ...local, participation: "away" };
				update();
			},
			rejoin() {
				if (!local) return;
				local = { ...local, participation: "joined", moveSeq: local.moveSeq + 1 };
				update();
			},
			refresh: update,
			resolveTarget: (place) => resolveGatherTarget(store, place, options.getViewportSize()),
		};
		const offService = gatherService.provide(ctx.services, api);

		return () => {
			disposed = true;
			offClient();
			offService();
			if (tick !== null) clearInterval(tick);
			releaseCamera();
			listeners.clear();
		};
	};

	return { type: GATHER_TYPE, label: "集合", attach };
}

/**
 * The place for a gathering: the bounds of the selected shapes (following the
 * shape when exactly one is selected), or the world area currently on screen.
 */
export function resolveGatherTarget(
	store: BoardStore,
	place: "selection" | "view",
	size: ViewportSize | null,
): GatherTarget | null {
	if (place === "view") {
		if (!size || size.width <= 0 || size.height <= 0) return null;
		return { rect: visibleWorldRect(store.getViewport(), size) };
	}
	const shapes = [...store.getSelection()]
		.map((id) => store.getShape(id))
		.filter((s): s is NonNullable<typeof s> => s !== undefined && (s.width > 0 || s.height > 0));
	const first = shapes[0];
	if (!first) return null;
	let minX = first.x;
	let minY = first.y;
	let maxX = first.x + first.width;
	let maxY = first.y + first.height;
	for (const s of shapes) {
		minX = Math.min(minX, s.x);
		minY = Math.min(minY, s.y);
		maxX = Math.max(maxX, s.x + s.width);
		maxY = Math.max(maxY, s.y + s.height);
	}
	// A lone horizontal / vertical line still makes a place (a rect must be > 0).
	return {
		rect: { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) },
		...(shapes.length === 1 ? { shapeId: first.id } : {}),
	};
}
