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

/** ページを使うボード: ページごとのシェイプと、読まれたページを記録する。 */
function setupPaged(pages: Record<string, ShapeData[]>, options: { legacy?: ShapeData[] } = {}) {
	const { storage, map } = fakeStorage();
	const board = new Map<string, Map<string, ShapeData>>(
		Object.entries(pages).map(([id, shapes]) => [id, new Map(shapes.map((s) => [s.id, s]))]),
	);
	// ページ形式にする前のルート shapes（移行前のコミットを作るため）
	const legacy = options.legacy ? new Map(options.legacy.map((s) => [s.id, s])) : null;
	let paged = !legacy;
	const reads: (string | null)[] = [];
	let clock = Date.UTC(2026, 10, 12, 0, 0, 0);
	const history = createHistoryManager({
		storage,
		getShapes: async (pageId) => {
			reads.push(pageId);
			if (pageId === null) return Object.fromEntries(legacy ?? new Map());
			return Object.fromEntries(board.get(pageId) ?? new Map());
		},
		getPageIds: async () => (paged ? [...board.keys()] : null),
		getLegacyPageId: async () => (paged ? ([...board.keys()][0] ?? null) : null),
		now: () => {
			clock += 1000;
			return clock;
		},
	});
	return {
		history,
		board,
		map,
		reads,
		migrate: () => {
			paged = true;
		},
	};
}

describe("createHistoryManager — pages", () => {
	it("ページごとの tree でコミットし、ページ指定で読める", async () => {
		const { history } = setupPaged({ p1: [shape("a")], p2: [shape("b"), shape("c")] });
		const commit = await history.recordCommit({ trigger: "auto" });
		expect(commit?.layout).toBe("pages");
		expect(commit?.shapeCount).toBe(3);
		expect(commit?.stats).toEqual({ added: 3, removed: 0, modified: 0 });

		const hash = commit?.hash as string;
		expect((await history.getCommit(hash, "p2"))?.shapes.map((s) => s.id)).toEqual(["b", "c"]);
		// 省略時は先頭ページ
		const first = await history.getCommit(hash);
		expect(first?.pageId).toBe("p1");
		expect(first?.shapes.map((s) => s.id)).toEqual(["a"]);
		// そのコミットに無いページは空
		expect((await history.getCommit(hash, "zz"))?.shapes).toEqual([]);
	});

	it("自動コミットは編集されたページだけを読む", async () => {
		const { history, board, reads } = setupPaged({ p1: [shape("a")], p2: [shape("b")] });
		await history.recordCommit({ trigger: "auto" });
		reads.length = 0;

		board.get("p2")?.set("b", shape("b", { x: 10 }));
		board.get("p1")?.set("a", shape("a", { x: 99 })); // 印の無い編集は読まない
		history.noteEdit("p2");
		const commit = await history.recordCommit({ trigger: "auto" });
		expect(reads).toEqual(["p2"]);
		expect(commit?.stats).toEqual({ added: 0, removed: 0, modified: 1 });
		expect(commit?.shapeCount).toBe(2);

		// 何も編集されていなければ何も読まず、コミットもしない
		reads.length = 0;
		expect(await history.recordCommit({ trigger: "auto" })).toBeNull();
		expect(reads).toEqual([]);

		// 手動コミットは全ページを読み直す
		const manual = await history.recordCommit({ trigger: "manual", allowEmpty: true });
		expect(reads.sort()).toEqual(["p1", "p2"]);
		expect(manual?.stats.modified).toBe(1);
	});

	it("ページの差分を現在のボードや別のコミットと比べられる", async () => {
		const { history, board } = setupPaged({ p1: [shape("a")], p2: [shape("b")] });
		const c1 = (await history.recordCommit({ trigger: "auto" }))?.hash as string;
		board.get("p2")?.set("n", shape("n"));
		history.noteEdit("p2");
		const c2 = (await history.recordCommit({ trigger: "auto" }))?.hash as string;

		const toCommit = await history.diff(c1, c2, "p2");
		expect(toCommit?.pageId).toBe("p2");
		expect(toCommit?.added.map((s) => s.id)).toEqual(["n"]);
		expect((await history.diff(c1, c2, "p1"))?.added).toEqual([]);

		board.get("p1")?.delete("a");
		const working = await history.diff(c2, "working", "p1");
		expect(working?.removed.map((s) => s.id)).toEqual(["a"]);
	});

	it("消えたページのシェイプは removed に数える", async () => {
		const { history, board } = setupPaged({ p1: [shape("a")], p2: [shape("b"), shape("c")] });
		await history.recordCommit({ trigger: "auto" });
		board.delete("p2");
		const commit = await history.recordCommit({ trigger: "auto" });
		expect(commit?.stats).toEqual({ added: 0, removed: 2, modified: 0 });
		expect(commit?.shapeCount).toBe(1);
	});

	it("ページ形式にする前のコミットは、移行先のページの中身として見える", async () => {
		const { history, migrate } = setupPaged(
			{ p1: [shape("a"), shape("b")], p2: [] },
			{
				legacy: [shape("a"), shape("b")],
			},
		);
		const before = (await history.recordCommit({ trigger: "auto" }))?.hash as string;
		expect((await history.getCommit(before))?.pageId).toBeNull();

		migrate();
		const detail = await history.getCommit(before, "p1");
		expect(detail?.shapes.map((s) => s.id)).toEqual(["a", "b"]);
		expect((await history.getCommit(before, "p2"))?.shapes).toEqual([]);

		// 移行後の最初のコミット: 中身は同じなので p1 の変更は 0
		const after = await history.recordCommit({ trigger: "auto" });
		expect(after?.layout).toBe("pages");
		expect(after?.stats).toEqual({ added: 0, removed: 0, modified: 0 });
		expect((await history.diff(before, "working", "p1"))?.added).toEqual([]);
	});

	it("コミットに失敗したら編集の印を戻す", async () => {
		const { history, board, reads } = setupPaged({ p1: [shape("a")] });
		await history.recordCommit({ trigger: "auto" });
		history.noteEdit("p1");
		board.get("p1")?.set("bad", { id: "bad", x: 1n } as unknown as ShapeData);
		await expect(history.recordCommit({ trigger: "auto" })).rejects.toThrow();
		board.get("p1")?.delete("bad");
		board.get("p1")?.set("ok", shape("ok"));
		reads.length = 0;
		const commit = await history.recordCommit({ trigger: "auto" });
		expect(reads).toEqual(["p1"]);
		expect(commit?.stats.added).toBe(1);
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
