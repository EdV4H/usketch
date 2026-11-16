import type { ClientSessionType, SessionAttachContext } from "@edv4h/usketch-plugin-session";
import type { Participant, SessionView } from "@edv4h/usketch-session-protocol";
import {
	type BoardStore,
	defineService,
	getSelectionBounds,
	type ServiceRegistry,
	type ViewportConstraint,
} from "@edv4h/usketch-shared";
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
	/** Who has taken part so far (the host first, then in the order they joined). */
	participants: readonly Participant[];
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
	/** Step away (or skip the countdown, or decline the invitation). */
	leave(): void;
	/**
	 * Take part: answers the invitation (`confirmJoin`) or joins after declining.
	 * The person is recorded as a participant at once and moved after
	 * `enterDelayMs` (`participation` is `countdown` until then).
	 */
	accept(): void;
	/** Come back / go to the place again now (also for the host). */
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
	/**
	 * Ask everyone but the host before taking part (`participation` starts as
	 * `invited`; answer with `accept` / `leave`) instead of counting down. Default false.
	 */
	confirmJoin?: boolean;
	/**
	 * After `accept`, wait this long before moving, e.g. while the host plays an
	 * intro that covers the move. Default 0.
	 */
	enterDelayMs?: number;
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
	/** This client's state for gatherings pushed aside by a newer one (they can come back). */
	const past = new Map<string, Local>();
	/** Per gathering, the `moveSeq` this client was already brought there for. */
	const moved = new Map<string, number>();
	let firstAttach = true;
	let seenOnLoadId: string | null = null;
	let startAway = false;
	/** Gatherings this client ended (id → whether by time). */
	const endedByMe = new Map<string, boolean>();
	let stayPutPending = false;
	/** Gatherings this client has sent `join` for (sent once each). */
	const joinSent = new Set<string>();
	/** Gatherings shown here and not yet reported to `onEnded`. */
	const shown = new Map<string, GatherPublic>();

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
			participants: [],
		};
		let tick: ReturnType<typeof setInterval> | null = null;
		let installTimer: ReturnType<typeof setTimeout> | null = null;
		let applied: string | null = null;
		let switchedFor: string | null = null;
		let installed: ViewportConstraint | null = null;
		let endSentFor: unknown = null;
		let movedOnAppear = false;
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

		const releaseCamera = () => {
			if (installTimer !== null) clearTimeout(installTimer);
			installTimer = null;
			// Only clear our own constraint, never one another plugin / the host installed.
			if (installed && store.getViewportConstraint() === installed) {
				store.setViewportConstraint(null);
			}
			installed = null;
		};

		const applyCamera = (live: { session: SessionView; gather: GatherPublic } | null) => {
			const key =
				live && local?.participation === "joined" ? `${live.session.id}:${local.moveSeq}` : null;
			if (key === applied) return;
			applied = key;
			releaseCamera();
			if (!live || !key || !local) return;
			const { gather, session } = live;
			const isHost = session.hostUserId === userId;
			const holds = gather.hold === "stay" && !isHost;
			// Already brought there (before a page switch / app rebuild): under `gather`,
			// and for the host, they are free to move, so don't pull them back.
			if (moved.get(session.id) === local.moveSeq && !holds) return;
			const page = options.getPageId?.() ?? null;
			if (gather.target.pageId && page && gather.target.pageId !== page) {
				switchedFor = session.id;
				options.switchPage?.(gather.target.pageId);
				return;
			}
			const instant = instantNext || switchedFor === session.id;
			if (instantNext) movedOnAppear = true;
			instantNext = false;
			switchedFor = null;
			const stayPut = isHost && stayPutPending;
			stayPutPending = false;
			moved.set(session.id, local.moveSeq);
			const size = options.getViewportSize();
			if (size && !stayPut) {
				const target = fitViewport(shapeRect(store, gather), size);
				if (instant) store.setViewport(target);
				else store.animateViewportTo(target, { durationMs: MOVE_MS });
			}
			if (!holds) return;
			const install = () => {
				installTimer = null;
				// A gathering's public state is fixed at creation, so the captured one is
				// current; its removal re-runs applyCamera and releases this.
				installed = stayInRectConstraint({
					getRect: () => (isGatherLive(gather, now()) ? shapeRect(store, gather) : null),
					getSize: options.getViewportSize,
				});
				store.setViewportConstraint(installed);
			};
			if (instant) install();
			else installTimer = setTimeout(install, MOVE_MS + 50);
		};

		const recordJoin = (session: SessionView) => {
			if (joinSent.has(session.id)) return;
			if (session.participants.some((p) => p.userId === userId)) return;
			joinSent.add(session.id);
			client.join(session.id);
		};

		const update = () => {
			if (disposed) return;
			const t = now();
			let sessions = client.getState().sessions;
			// Over by time: the host's client removes it; everyone else just ignores it.
			// Sent once per snapshot: on a server transport the removal comes back later,
			// and the ticks in between must not resend it.
			if (sessions !== endSentFor) {
				const expired = sessions.filter((s) => {
					if (s.type !== GATHER_TYPE || s.hostUserId !== userId) return false;
					const g = parseGather(s.public);
					return g !== null && !isGatherLive(g, t);
				});
				if (expired.length > 0) {
					endSentFor = sessions;
					for (const s of expired) {
						endedByMe.set(s.id, true);
						client.end(s.id);
					}
					if (disposed) return;
					sessions = client.getState().sessions;
				}
			}
			const live = pickLive(sessions, t);
			if (live) shown.set(live.session.id, live.gather);
			for (const [id, g] of shown) {
				// Pushed aside by a newer gathering is not over: it may come back.
				if (isGatherLive(g, t) && sessions.some((s) => s.id === id)) continue;
				shown.delete(id);
				const mine = endedByMe.get(id);
				endedByMe.delete(id);
				options.onEnded?.({
					gather: g,
					byMe: mine !== undefined,
					timedOut: mine ?? !isGatherLive(g, t),
				});
			}
			for (const id of [...past.keys(), ...moved.keys(), ...joinSent]) {
				if (!sessions.some((s) => s.id === id)) {
					past.delete(id);
					moved.delete(id);
					joinSent.delete(id);
				}
			}

			const isHost = live?.session.hostUserId === userId;
			if (local && local.id !== live?.session.id) past.set(local.id, local);
			if (!live) {
				local = null;
			} else if (local?.id !== live.session.id) {
				const kept = past.get(live.session.id);
				past.delete(live.session.id);
				local = kept ?? {
					id: live.session.id,
					participation: initialParticipation({
						isHost,
						canAutoMove: canAutoMove(),
						seenOnLoad: seenOnLoadId === live.session.id,
						startAway,
						confirm: options.confirmJoin === true,
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
				participants: live
					? [...live.session.participants].sort((a, b) => a.joinedAt - b.joinedAt)
					: [],
			};
			const wantTick = live ? (participation === "countdown" ? 200 : 1000) : null;
			if (tick !== null) clearInterval(tick);
			tick = wantTick === null ? null : setInterval(update, wantTick);
			for (const l of listeners) l();
			// Taking part is recorded in the session, so everyone sees who came and in
			// which order. Last, since the transport may notify (and re-enter) at once.
			if (live && participation === "joined") recordJoin(live.session);
		};

		const offClient = client.subscribe(update);
		update();
		instantNext = false;
		// Claim the load-time camera only when this app actually moved it.
		if (movedOnAppear) {
			queueMicrotask(() => {
				if (disposed) return;
				ctx.events.emit("viewport:claimed", {
					source: "session-gather",
					priority: options.claimPriority ?? 50,
				});
			});
		}

		const api: GatherApi = {
			getState: () => state,
			subscribe(listener) {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
			start(input, opts) {
				// End every gathering this client runs, not only the newest one shown.
				const mine = client
					.getState()
					.sessions.filter((s) => s.type === GATHER_TYPE && s.hostUserId === userId);
				for (const s of mine) {
					endedByMe.set(s.id, false);
					client.end(s.id);
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
				endedByMe.set(live.session.id, false);
				client.end(live.session.id);
			},
			leave() {
				if (!local) return;
				local = { ...local, participation: "away" };
				update();
			},
			accept() {
				if (!local || local.participation === "joined") return;
				const live = pickLive(client.getState().sessions, now());
				if (live?.session.id !== local.id) return;
				const delay = Math.max(0, options.enterDelayMs ?? 0);
				local = {
					...local,
					participation: delay > 0 ? "countdown" : "joined",
					countdownEndsAt: now() + delay,
					moveSeq: local.moveSeq + 1,
				};
				update();
				recordJoin(live.session);
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
	const shapes = new Map(
		[...store.getSelection()]
			.map((id) => store.getShape(id))
			.filter((s): s is NonNullable<typeof s> => s !== undefined && (s.width > 0 || s.height > 0))
			.map((s) => [s.id, s] as const),
	);
	const bounds = getSelectionBounds(new Set(shapes.keys()), (id) => shapes.get(id) ?? null);
	if (!bounds) return null;
	const [only] = shapes.size === 1 ? shapes.keys() : [];
	// A lone horizontal / vertical line still makes a place (a rect must be > 0).
	return {
		rect: {
			x: bounds.x,
			y: bounds.y,
			width: Math.max(1, bounds.width),
			height: Math.max(1, bounds.height),
		},
		...(only ? { shapeId: only } : {}),
	};
}
