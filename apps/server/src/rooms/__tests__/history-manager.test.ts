import type { ShapeData } from "@edv4h/usketch-shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleHistoryRequest } from "../history-handler.js";
import {
	createHistoryManager,
	HISTORY_HEAD_KEY,
	HISTORY_LOG_PREFIX,
	HISTORY_OBJECT_PREFIX,
} from "../history-manager.js";

/** In-memory DurableObjectStorage: get/put (single + batch), delete, list. */
function fakeStorage() {
	const map = new Map<string, unknown>();
	const ops = { putKeys: [] as string[] };
	const storage = {
		get: async (key: string | string[]) => {
			if (Array.isArray(key)) {
				if (key.length > 128) throw new Error("too many keys");
				const out = new Map<string, unknown>();
				for (const k of key) if (map.has(k)) out.set(k, map.get(k));
				return out;
			}
			return map.get(key);
		},
		put: async (key: string | Record<string, unknown>, value?: unknown) => {
			if (typeof key === "string") {
				ops.putKeys.push(key);
				map.set(key, value);
				return;
			}
			const entries = Object.entries(key);
			if (entries.length > 128) throw new Error("too many keys");
			for (const [k, v] of entries) {
				ops.putKeys.push(k);
				map.set(k, v);
			}
		},
		delete: async (key: string) => map.delete(key),
		list: async (options: { prefix?: string; reverse?: boolean; limit?: number; end?: string }) => {
			let keys = [...map.keys()].filter((k) => k.startsWith(options.prefix ?? "")).sort();
			if (options.end !== undefined) keys = keys.filter((k) => k < (options.end as string));
			if (options.reverse) keys.reverse();
			if (options.limit !== undefined) keys = keys.slice(0, options.limit);
			return new Map(keys.map((k) => [k, map.get(k)]));
		},
	} as unknown as DurableObjectStorage;
	return { storage, map, ops };
}

function shape(id: string, extra: Partial<ShapeData> = {}): ShapeData {
	return {
		id,
		type: "rectangle",
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		rotation: 0,
		opacity: 1,
		...extra,
	} as ShapeData;
}

function setup(initial: ShapeData[] = []) {
	const { storage, map, ops } = fakeStorage();
	const board = new Map<string, ShapeData>(initial.map((s) => [s.id, s]));
	let clock = Date.UTC(2026, 10, 2, 0, 0, 0);
	const history = createHistoryManager({
		storage,
		getShapes: async () => Object.fromEntries(board),
		now: () => clock,
		idleMs: 1_000,
		maxWaitMs: 5_000,
	});
	const tick = (ms = 1_000) => {
		clock += ms;
	};
	return { history, board, storage, map, ops, tick };
}

function objectKeys(map: Map<string, unknown>): string[] {
	return [...map.keys()].filter((k) => k.startsWith(HISTORY_OBJECT_PREFIX));
}

describe("createHistoryManager", () => {
	it("records a first commit with every shape as added", async () => {
		const { history, map } = setup([shape("a"), shape("b")]);
		const commit = await history.recordCommit({ trigger: "auto" });

		expect(commit).not.toBeNull();
		expect(commit?.parents).toEqual([]);
		expect(commit?.shapeCount).toBe(2);
		expect(commit?.stats).toEqual({ added: 2, removed: 0, modified: 0 });
		expect(map.get(HISTORY_HEAD_KEY)).toBe(commit?.hash);
		// 2 blobs (identical content but different ids → different blobs) + tree + commit
		expect(objectKeys(map)).toHaveLength(4);
	});

	it("skips an auto commit when nothing changed, but not a manual one", async () => {
		const { history, tick } = setup([shape("a")]);
		const first = await history.recordCommit({ trigger: "auto" });
		tick();
		expect(await history.recordCommit({ trigger: "auto" })).toBeNull();
		tick();
		const manual = await history.recordCommit({
			trigger: "manual",
			message: "v1",
			author: "u1",
			allowEmpty: true,
		});
		expect(manual?.parents).toEqual([first?.hash]);
		expect(manual?.tree).toBe(first?.tree);
		expect(manual?.stats).toEqual({ added: 0, removed: 0, modified: 0 });
	});

	it("does not auto commit an empty board with no history", async () => {
		const { history, map } = setup();
		expect(await history.recordCommit({ trigger: "auto" })).toBeNull();
		expect(map.size).toBe(0);
	});

	it("ignores updatedAt-only changes", async () => {
		const { history, board, tick } = setup([shape("a", { updatedAt: 1 } as Partial<ShapeData>)]);
		await history.recordCommit({ trigger: "auto" });
		board.set("a", shape("a", { updatedAt: 2 } as Partial<ShapeData>));
		tick();
		expect(await history.recordCommit({ trigger: "auto" })).toBeNull();
	});

	it("writes only the blobs that changed", async () => {
		const shapes = Array.from({ length: 300 }, (_, i) => shape(`s${i}`, { x: i }));
		const { history, board, ops, tick } = setup(shapes);
		await history.recordCommit({ trigger: "auto" });

		ops.putKeys.length = 0;
		board.set("s7", shape("s7", { x: 999 }));
		tick();
		const second = await history.recordCommit({ trigger: "auto" });

		expect(second?.stats).toEqual({ added: 0, removed: 0, modified: 1 });
		const objectWrites = ops.putKeys.filter((k) => k.startsWith(HISTORY_OBJECT_PREFIX));
		// new blob + new tree + new commit
		expect(objectWrites).toHaveLength(3);
	});

	it("lists commits newest first with cursor paging", async () => {
		const { history, board, tick } = setup();
		const hashes: string[] = [];
		for (let i = 0; i < 5; i++) {
			board.set("a", shape("a", { x: i }));
			tick();
			const c = await history.recordCommit({ trigger: "auto" });
			hashes.push(c?.hash as string);
		}

		const page1 = await history.listCommits({ limit: 2 });
		expect(page1.head).toBe(hashes[4]);
		expect(page1.commits.map((c) => c.hash)).toEqual([hashes[4], hashes[3]]);
		expect(page1.nextCursor?.startsWith(HISTORY_LOG_PREFIX)).toBe(true);

		const page2 = await history.listCommits({ limit: 2, cursor: page1.nextCursor });
		expect(page2.commits.map((c) => c.hash)).toEqual([hashes[2], hashes[1]]);
		const page3 = await history.listCommits({ limit: 2, cursor: page2.nextCursor });
		expect(page3.commits.map((c) => c.hash)).toEqual([hashes[0]]);
		expect(page3.nextCursor).toBeNull();
	});

	it("returns the full board at a commit", async () => {
		const { history, board, tick } = setup([shape("a", { x: 1 }), shape("b")]);
		const first = await history.recordCommit({ trigger: "auto" });
		board.delete("b");
		board.set("a", shape("a", { x: 2 }));
		tick();
		await history.recordCommit({ trigger: "auto" });

		const detail = await history.getCommit(first?.hash as string);
		expect(detail?.shapes.map((s) => [s.id, s.x])).toEqual([
			["a", 1],
			["b", 0],
		]);
		expect(await history.getCommit("0".repeat(64))).toBeNull();
		expect(await history.getCommit("not-a-hash")).toBeNull();
	});

	it("diffs two commits and a commit against the current board", async () => {
		const { history, board, tick } = setup([shape("a", { x: 1 }), shape("b")]);
		const first = await history.recordCommit({ trigger: "auto" });
		board.delete("b");
		board.set("a", shape("a", { x: 2 }));
		board.set("c", shape("c"));
		tick();
		const second = await history.recordCommit({ trigger: "auto" });

		const d = await history.diff(first?.hash as string, second?.hash as string);
		expect(d?.added.map((s) => s.id)).toEqual(["c"]);
		expect(d?.removed.map((s) => s.id)).toEqual(["b"]);
		expect(d?.modified).toEqual([
			{
				id: "a",
				before: expect.objectContaining({ x: 1 }),
				after: expect.objectContaining({ x: 2 }),
				changes: [{ key: "x", before: 1, after: 2 }],
			},
		]);

		// Uncommitted edit shows up against the working board.
		board.set("d", shape("d"));
		const working = await history.diff(second?.hash as string);
		expect(working?.to).toBe("working");
		expect(working?.added.map((s) => s.id)).toEqual(["d"]);
		expect(working?.removed).toEqual([]);
		expect(working?.modified).toEqual([]);
	});

	it("keeps a linear history when commits race", async () => {
		const { history, board } = setup([shape("a")]);
		const p1 = history.recordCommit({ trigger: "manual", allowEmpty: true });
		board.set("a", shape("a", { x: 5 }));
		const p2 = history.recordCommit({ trigger: "manual", allowEmpty: true });
		const [c1, c2] = await Promise.all([p1, p2]);
		expect(c2?.parents).toEqual([c1?.hash]);
	});

	it("reads the head back after a restart", async () => {
		const { storage, board } = setup([shape("a")]);
		const before = createHistoryManager({
			storage,
			getShapes: async () => Object.fromEntries(board),
		});
		const first = await before.recordCommit({ trigger: "auto" });

		const after = createHistoryManager({
			storage,
			getShapes: async () => Object.fromEntries(board),
		});
		expect(await after.recordCommit({ trigger: "auto" })).toBeNull();
		board.set("b", shape("b"));
		const second = await after.recordCommit({ trigger: "auto" });
		expect(second?.parents).toEqual([first?.hash]);
	});

	describe("auto commit scheduling", () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});
		afterEach(() => {
			vi.useRealTimers();
		});

		it("commits after edits go idle", async () => {
			const { history, map } = setup([shape("a")]);
			history.noteEdit();
			await vi.advanceTimersByTimeAsync(999);
			expect(map.has(HISTORY_HEAD_KEY)).toBe(false);
			await vi.advanceTimersByTimeAsync(1);
			// Hashing uses Web Crypto (real async): wait in real time so no other fake timer fires.
			vi.useRealTimers();
			await vi.waitFor(() => expect(map.has(HISTORY_HEAD_KEY)).toBe(true));
		});

		it("commits within maxWait even while edits keep coming", async () => {
			const s = setup([shape("a")]);
			// The manager's clock is driven by `tick`; keep it in step with fake timers.
			for (let i = 0; i < 6; i++) {
				s.history.noteEdit();
				s.tick(900);
				await vi.advanceTimersByTimeAsync(900);
			}
			// The 1s idle timer never fires (edits every 0.9s); the 5s max wait does.
			vi.useRealTimers();
			await vi.waitFor(() => expect(s.map.has(HISTORY_HEAD_KEY)).toBe(true));
		});

		it("flushAutoCommit commits immediately and cancels the timer", async () => {
			const { history, map } = setup([shape("a")]);
			history.noteEdit();
			await history.flushAutoCommit();
			const head = map.get(HISTORY_HEAD_KEY);
			expect(head).toBeDefined();
			await vi.advanceTimersByTimeAsync(10_000);
			expect(map.get(HISTORY_HEAD_KEY)).toBe(head);
		});
	});
});

describe("handleHistoryRequest", () => {
	async function call(
		history: ReturnType<typeof setup>["history"],
		method: string,
		path: string,
		body?: unknown,
	) {
		const url = new URL(`https://room${path}`);
		const request = new Request(url, {
			method,
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		});
		const res = await handleHistoryRequest(request, url, history);
		return { res, data: res ? await res.json() : null };
	}

	it("ignores non-history paths", async () => {
		const { history } = setup();
		expect(
			await handleHistoryRequest(
				new Request("https://room/ws"),
				new URL("https://room/ws"),
				history,
			),
		).toBeNull();
	});

	it("creates a manual commit with the proxied userId as author", async () => {
		const { history } = setup([shape("a")]);
		const { res, data } = await call(history, "POST", "/history/commits?userId=u1", {
			message: "  first draft  ",
		});
		expect(res?.status).toBe(201);
		expect(data.commit).toMatchObject({ author: "u1", message: "first draft", trigger: "manual" });

		const list = await call(history, "GET", "/history");
		expect(list.data.commits).toHaveLength(1);
		expect(list.data.head).toBe(data.commit.hash);

		const detail = await call(history, "GET", `/history/commits/${data.commit.hash}`);
		expect(detail.data.shapes.map((s: ShapeData) => s.id)).toEqual(["a"]);

		const diff = await call(history, "GET", `/history/diff?from=${data.commit.hash}`);
		expect(diff.data).toMatchObject({ added: [], removed: [], modified: [] });
	});

	it("rejects bad input", async () => {
		const { history } = setup([shape("a")]);
		expect((await call(history, "POST", "/history/commits", { trigger: "auto" })).res?.status).toBe(
			400,
		);
		expect((await call(history, "POST", "/history/commits", { message: 3 })).res?.status).toBe(400);
		expect((await call(history, "GET", "/history/diff")).res?.status).toBe(400);
		expect((await call(history, "GET", `/history/diff?from=${"0".repeat(64)}`)).res?.status).toBe(
			404,
		);
		expect((await call(history, "GET", "/history/commits/zzz")).res?.status).toBe(404);
		expect((await call(history, "GET", "/history?limit=abc")).res?.status).toBe(400);
		expect((await call(history, "DELETE", "/history")).res?.status).toBe(404);
	});
});
