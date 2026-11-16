import { createYjsSessionClient, type SessionClient } from "@edv4h/usketch-plugin-session";
import type { BoardStore, EventBus, ServiceRegistry, Viewport } from "@edv4h/usketch-shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import {
	createGatherClientType,
	type GatherApi,
	type GatherClientOptions,
	getGatherApi,
} from "../client.js";
import { GATHER_COUNTDOWN_MS } from "../gather.js";
import { gatherServerType } from "../server.js";

const SIZE = { width: 1000, height: 800 };
const PLACE = { x: 0, y: 0, width: 200, height: 100 };

let clock = 0;
const now = () => clock;

/** Two linked docs, like peers in one y-websocket room. */
function linkedDocs() {
	const a = new Y.Doc();
	const b = new Y.Doc();
	a.on("update", (u: Uint8Array, origin: unknown) => {
		if (origin !== "remote") Y.applyUpdate(b, u, "remote");
	});
	b.on("update", (u: Uint8Array, origin: unknown) => {
		if (origin !== "remote") Y.applyUpdate(a, u, "remote");
	});
	return { a, b };
}

let ids = 0;
const sessionClient = (doc: Y.Doc, userId: string): SessionClient =>
	createYjsSessionClient({
		doc,
		userId,
		types: [gatherServerType],
		now,
		genId: () => `g${ids++}`,
	});

/** Just the BoardStore surface the gather client touches. */
function fakeStore() {
	let viewport: Viewport = { x: 0, y: 0, zoom: 1 };
	let constraint: unknown = null;
	const store = {
		getShape: vi.fn(() => undefined),
		getSelection: vi.fn(() => new Set<string>()),
		getViewport: () => viewport,
		setViewport: vi.fn((vp: Viewport) => {
			viewport = vp;
		}),
		animateViewportTo: vi.fn((vp: Viewport) => {
			viewport = vp;
		}),
		setViewportConstraint: vi.fn((c: unknown) => {
			constraint = c;
		}),
		getViewportConstraint: () => constraint,
	};
	return store;
}

function fakeServices(): ServiceRegistry {
	const map = new Map<string, unknown>();
	return {
		provide(key, service) {
			map.set(key, service);
			return () => map.delete(key);
		},
		get: <T>(key: string) => map.get(key) as T | undefined,
		has: (key) => map.has(key),
	};
}

function fakeEvents() {
	const emitted: Array<{ event: string; data: unknown }> = [];
	const bus = {
		on: () => () => {},
		emit: (event: string, data: unknown) => emitted.push({ event, data }),
		pause: () => {},
		resume: () => {},
	} as unknown as EventBus;
	return { bus, emitted };
}

/** One person's board: a session client, the gather type, and the attached controller. */
function board(doc: Y.Doc, userId: string, opts: Partial<GatherClientOptions> = {}) {
	const client = sessionClient(doc, userId);
	const store = fakeStore();
	const services = fakeServices();
	const events = fakeEvents();
	const type = createGatherClientType({ getViewportSize: () => SIZE, now, ...opts });
	const attach = () =>
		type.attach?.({
			client,
			userId,
			store: store as unknown as BoardStore,
			services,
			events: events.bus,
		});
	const detach = attach();
	const api = () => {
		const a = getGatherApi(services);
		if (!a) throw new Error("gather service missing");
		return a;
	};
	return { client, store, services, events, type, attach, detach, api };
}

const startHere = (api: GatherApi, hold: "gather" | "stay" = "stay", minutes = 0) =>
	api.start({ hold, target: { rect: PLACE }, hostName: "Host", durationMinutes: minutes });

beforeEach(() => {
	vi.useFakeTimers();
	clock = 1_000_000;
});
afterEach(() => {
	vi.useRealTimers();
});

/** Move the clock and the timers together, 50 ms at a time. */
const advance = (ms: number) => {
	for (let left = ms; left > 0; left -= 50) {
		const step = Math.min(50, left);
		clock += step;
		vi.advanceTimersByTime(step);
	}
};

describe("gather client", () => {
	it("開いている人はカウントダウンのあと場所へ動き、stay なら囲われる", () => {
		const { a, b } = linkedDocs();
		const host = board(a, "host");
		const guest = board(b, "guest");
		startHere(host.api());

		expect(guest.api().getState().participation).toBe("countdown");
		expect(guest.store.animateViewportTo).not.toHaveBeenCalled();

		advance(GATHER_COUNTDOWN_MS + 200);
		expect(guest.api().getState().participation).toBe("joined");
		expect(guest.store.animateViewportTo).toHaveBeenCalledTimes(1);
		// 囲いは動き終わってから
		expect(guest.store.setViewportConstraint).not.toHaveBeenCalledWith(expect.any(Function));
		advance(800);
		expect(guest.store.setViewportConstraint).toHaveBeenLastCalledWith(expect.any(Function));
	});

	it("主催者は動かされず、囲われない", () => {
		const { a, b } = linkedDocs();
		const host = board(a, "host");
		board(b, "guest");
		startHere(host.api());
		advance(2000);
		expect(host.api().getState()).toMatchObject({ isHost: true, participation: "joined" });
		expect(host.store.setViewportConstraint).not.toHaveBeenCalledWith(expect.any(Function));
	});

	it("今見ている場所から始めた主催者のカメラは動かない", () => {
		const { a } = linkedDocs();
		const host = board(a, "host");
		const target = host.api().resolveTarget("view");
		expect(target).toEqual({ rect: { x: 0, y: 0, width: 1000, height: 800 } });
		if (!target) return;
		host.api().start({ hold: "gather", target }, { stayPut: true });
		expect(host.store.setViewport).not.toHaveBeenCalled();
		expect(host.store.animateViewportTo).not.toHaveBeenCalled();
	});

	it("あとから開いた人はすぐ場所に入り、読み込み時のカメラを取る", async () => {
		const { a, b } = linkedDocs();
		const host = board(a, "host");
		startHere(host.api());
		advance(60_000);
		const late = board(b, "late");
		expect(late.api().getState().participation).toBe("joined");
		expect(late.store.setViewport).toHaveBeenCalledTimes(1);
		expect(late.store.setViewportConstraint).toHaveBeenLastCalledWith(expect.any(Function));
		await Promise.resolve();
		expect(late.events.emitted).toEqual([
			{ event: "viewport:claimed", data: { source: "session-gather", priority: 50 } },
		]);
	});

	it("ディープリンクで開いた人は離れた状態から始まり、カメラも取らない", async () => {
		const { a, b } = linkedDocs();
		const host = board(a, "host");
		startHere(host.api());
		advance(60_000);
		const late = board(b, "late", { startAway: () => true });
		expect(late.api().getState().participation).toBe("away");
		expect(late.store.setViewport).not.toHaveBeenCalled();
		await Promise.resolve();
		expect(late.events.emitted).toEqual([]);
	});

	it("離れると囲いが外れ、戻るともう一度場所へ動く", () => {
		const { a, b } = linkedDocs();
		const host = board(a, "host");
		startHere(host.api());
		advance(60_000);
		const late = board(b, "late");
		late.api().leave();
		expect(late.api().getState().participation).toBe("away");
		expect(late.store.setViewportConstraint).toHaveBeenLastCalledWith(null);
		late.api().rejoin();
		expect(late.api().getState().participation).toBe("joined");
		expect(late.store.animateViewportTo).toHaveBeenCalledTimes(1);
		// 参加中でも「もう一度行く」で動き直す
		late.api().rejoin();
		expect(late.store.animateViewportTo).toHaveBeenCalledTimes(2);
	});

	it("カメラを動かせない間は離れた扱いになる", () => {
		const { a, b } = linkedDocs();
		const host = board(a, "host");
		let presenting = false;
		const guest = board(b, "guest", { canAutoMove: () => !presenting });
		startHere(host.api());
		advance(GATHER_COUNTDOWN_MS + 1000);
		expect(guest.api().getState().participation).toBe("joined");
		presenting = true;
		guest.api().refresh();
		expect(guest.api().getState().participation).toBe("away");
		expect(guest.store.setViewportConstraint).toHaveBeenLastCalledWith(null);
	});

	it("別のページの集合なら、まずそのページへ移り、新しいアプリで場所に入る", () => {
		const { a, b } = linkedDocs();
		const host = board(a, "host", { getPageId: () => "p2" });
		startHere(host.api());
		expect(host.api().getState().gather?.target.pageId).toBe("p2");
		advance(60_000);

		let page = "p1";
		const switchPage = vi.fn((id: string) => {
			page = id;
		});
		const late = board(b, "late", { getPageId: () => page, switchPage });
		expect(switchPage).toHaveBeenCalledWith("p2");
		expect(late.store.setViewport).not.toHaveBeenCalled();

		// ホストはページごとにアプリを作り直す: 同じ型でつけ直す
		late.detach?.();
		late.attach();
		expect(late.store.setViewport).toHaveBeenCalledTimes(1);
		expect(late.api().getState().participation).toBe("joined");
	});

	it("gather で一度連れてこられた人は、アプリを作り直しても引き戻されない", () => {
		const { a, b } = linkedDocs();
		const host = board(a, "host");
		startHere(host.api(), "gather");
		advance(60_000);
		const late = board(b, "late");
		expect(late.store.setViewport).toHaveBeenCalledTimes(1);
		late.detach?.();
		late.attach();
		expect(late.store.setViewport).toHaveBeenCalledTimes(1);
		expect(late.api().getState().participation).toBe("joined");
	});

	it("別の人の新しい集合に隠れただけでは onEnded は届かない", () => {
		const { a, b } = linkedDocs();
		const ended = vi.fn();
		const host = board(a, "host");
		const other = board(b, "other", { onEnded: ended });
		startHere(host.api());
		advance(1000);
		startHere(other.api(), "gather");
		expect(other.api().getState().gather?.hold).toBe("gather");
		expect(ended).not.toHaveBeenCalled();
		other.api().end();
		expect(ended).toHaveBeenCalledTimes(1);
		expect(other.api().getState().gather?.hold).toBe("stay");
	});

	it("離れたことはアプリを作り直しても残る", () => {
		const { a, b } = linkedDocs();
		const host = board(a, "host");
		startHere(host.api());
		advance(60_000);
		const late = board(b, "late");
		late.api().leave();
		late.detach?.();
		late.attach();
		expect(late.api().getState().participation).toBe("away");
	});

	it("時間切れになると主催者が終え、全員に onEnded が届く", () => {
		const { a, b } = linkedDocs();
		const hostEnded = vi.fn();
		const guestEnded = vi.fn();
		const host = board(a, "host", { onEnded: hostEnded });
		const guest = board(b, "guest", { onEnded: guestEnded });
		startHere(host.api(), "stay", 1);
		expect(guest.api().getState().remainingMs).toBe(60_000);
		advance(GATHER_COUNTDOWN_MS + 500);
		advance(60_000);
		expect(host.client.getState().sessions).toHaveLength(0);
		expect(guest.api().getState().session).toBeNull();
		expect(hostEnded).toHaveBeenCalledWith(expect.objectContaining({ byMe: true, timedOut: true }));
		expect(guestEnded).toHaveBeenCalledWith(
			expect.objectContaining({ byMe: false, timedOut: true }),
		);
		expect(guest.store.setViewportConstraint).toHaveBeenLastCalledWith(null);
	});

	it("主催者が終えると、ほかの人の囲いが外れる。主催者以外は終えられない", () => {
		const { a, b } = linkedDocs();
		const hostEnded = vi.fn();
		const guestEnded = vi.fn();
		const host = board(a, "host", { onEnded: hostEnded });
		const guest = board(b, "guest", { onEnded: guestEnded });
		startHere(host.api());
		advance(GATHER_COUNTDOWN_MS + 1000);
		guest.api().end();
		expect(guest.api().getState().session).not.toBeNull();
		host.api().end();
		expect(guest.api().getState().session).toBeNull();
		expect(hostEnded).toHaveBeenCalledWith(
			expect.objectContaining({ byMe: true, timedOut: false }),
		);
		expect(guestEnded).toHaveBeenCalledWith(
			expect.objectContaining({ byMe: false, timedOut: false }),
		);
		expect(guest.store.setViewportConstraint).toHaveBeenLastCalledWith(null);
	});

	it("主催者が始め直すと前の集合は終わり、新しい方だけが残る", () => {
		const { a, b } = linkedDocs();
		const host = board(a, "host");
		const guest = board(b, "guest");
		startHere(host.api());
		const first = host.api().getState().session?.id;
		advance(1000);
		startHere(host.api(), "gather");
		const sessions = guest.client.getState().sessions;
		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.id).not.toBe(first);
		expect(guest.api().getState().gather?.hold).toBe("gather");
	});

	it("選んだ図形 1 つならその図形を追い、線でも場所になる", () => {
		const { a } = linkedDocs();
		const host = board(a, "host");
		host.store.getSelection.mockReturnValue(new Set(["line"]));
		host.store.getShape.mockImplementation(
			() => ({ id: "line", x: 10, y: 20, width: 300, height: 0 }) as never,
		);
		expect(host.api().resolveTarget("selection")).toEqual({
			rect: { x: 10, y: 20, width: 300, height: 1 },
			shapeId: "line",
		});
	});

	it("片付けるとサービスと囲いを外す", () => {
		const { a, b } = linkedDocs();
		const host = board(a, "host");
		startHere(host.api());
		advance(60_000);
		const late = board(b, "late");
		late.detach?.();
		expect(getGatherApi(late.services)).toBeUndefined();
		expect(late.store.setViewportConstraint).toHaveBeenLastCalledWith(null);
	});

	describe("confirmJoin", () => {
		it("聞かれた人は動かず、参加すると参加者に入り、待ってから動く", () => {
			const { a, b } = linkedDocs();
			const host = board(a, "host", { confirmJoin: true });
			const guest = board(b, "guest", { confirmJoin: true, enterDelayMs: 4000 });
			startHere(host.api());
			advance(GATHER_COUNTDOWN_MS + 1000);
			expect(guest.api().getState().participation).toBe("invited");
			expect(guest.store.animateViewportTo).not.toHaveBeenCalled();
			expect(
				host
					.api()
					.getState()
					.participants.map((p) => p.userId),
			).toEqual(["host"]);

			guest.api().accept();
			expect(guest.api().getState().participation).toBe("countdown");
			expect(
				host
					.api()
					.getState()
					.participants.map((p) => p.userId),
			).toEqual(["host", "guest"]);
			advance(3000);
			expect(guest.store.animateViewportTo).not.toHaveBeenCalled();
			advance(1200);
			expect(guest.api().getState().participation).toBe("joined");
			expect(guest.store.animateViewportTo).toHaveBeenCalledTimes(1);
		});

		it("あとでを選ぶと離れたまま。あとから参加すると待たずに動く", () => {
			const { a, b } = linkedDocs();
			const host = board(a, "host", { confirmJoin: true });
			const guest = board(b, "guest", { confirmJoin: true });
			startHere(host.api());
			guest.api().leave();
			expect(guest.api().getState().participation).toBe("away");
			guest.api().accept();
			expect(guest.api().getState().participation).toBe("joined");
			expect(guest.store.animateViewportTo).toHaveBeenCalledTimes(1);
		});

		it("あとから開いた人も聞かれ、ディープリンクで開いた人は離れたまま", () => {
			const { a, b } = linkedDocs();
			const host = board(a, "host", { confirmJoin: true });
			startHere(host.api());
			advance(60_000);
			const late = board(b, "late", { confirmJoin: true });
			expect(late.api().getState().participation).toBe("invited");
			expect(late.store.setViewport).not.toHaveBeenCalled();
			const c = new Y.Doc();
			Y.applyUpdate(c, Y.encodeStateAsUpdate(a));
			const linked = board(c, "linked", { confirmJoin: true, startAway: () => true });
			expect(linked.api().getState().participation).toBe("away");
		});
	});

	it("参加すると (カウントダウンでも) 参加者に記録する", () => {
		const { a, b } = linkedDocs();
		const host = board(a, "host");
		board(b, "guest");
		startHere(host.api());
		expect(host.api().getState().participants).toHaveLength(1);
		advance(GATHER_COUNTDOWN_MS + 200);
		expect(
			host
				.api()
				.getState()
				.participants.map((p) => p.userId),
		).toEqual(["host", "guest"]);
	});
});
