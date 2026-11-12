import type {
	BoardStore,
	Command,
	CommandRegistry,
	EventBus,
	ShapeData,
} from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import {
	createHistoryClient,
	type HistoryClient,
	type HistoryCommitSummary,
	HistoryRequestError,
} from "../history-client.js";
import { createHistoryController } from "../history-controller.js";
import { restoreCommit, restoreShapes } from "../history-ops.js";

const style = { fillColor: "#fff", strokeColor: "#000", strokeWidth: 1, opacity: 1 };
const H1 = "1".repeat(64);
const H2 = "2".repeat(64);

function shape(id: string, extra: Partial<ShapeData> = {}): ShapeData {
	return { id, type: "rectangle", x: 0, y: 0, width: 10, height: 10, style, ...extra } as ShapeData;
}

function fakeStore(initial: ShapeData[]): BoardStore {
	let shapes = new Map(initial.map((s) => [s.id, s]));
	return {
		getShapes: () => shapes,
		getShape: (id: string) => shapes.get(id),
		addShape: (s: ShapeData) => {
			shapes = new Map(shapes).set(s.id, s);
		},
		updateShape: (id: string, changes: Partial<ShapeData>) => {
			const existing = shapes.get(id);
			if (existing) shapes = new Map(shapes).set(id, { ...existing, ...changes, id });
		},
		deleteShape: (id: string) => {
			shapes = new Map(shapes);
			shapes.delete(id);
		},
	} as unknown as BoardStore;
}

/** A command stack with undo, like the app's CommandRegistry. */
function fakeCommands(): CommandRegistry & { done: Command[] } {
	const done: Command[] = [];
	return {
		done,
		execute(command: Command) {
			command.execute();
			done.push(command);
		},
		undo() {
			done.pop()?.undo();
		},
		redo() {},
		canUndo: () => done.length > 0,
		canRedo: () => false,
		getHistorySize: () => done.length,
		getCursor: () => done.length,
	};
}

function fakeEvents(): EventBus & { emitted: { event: string; data: unknown }[] } {
	const emitted: { event: string; data: unknown }[] = [];
	return {
		emitted,
		on: () => () => {},
		emit: (event: string, data: unknown) => {
			emitted.push({ event, data });
		},
		pause() {},
		resume() {},
	} as unknown as EventBus & { emitted: { event: string; data: unknown }[] };
}

function summary(hash: string, extra: Partial<HistoryCommitSummary> = {}): HistoryCommitSummary {
	return {
		hash,
		tree: "t".repeat(64),
		parents: [],
		createdAt: "2026-11-12T00:00:00.000Z",
		author: null,
		message: "",
		trigger: "auto",
		shapeCount: 1,
		stats: { added: 1, removed: 0, modified: 0 },
		...extra,
	};
}

/** In-memory HistoryClient: commit H1 holds `snapshot`. */
function fakeClient(snapshot: ShapeData[]): HistoryClient & { created: unknown[] } {
	const created: unknown[] = [];
	const commits = [summary(H1)];
	return {
		created,
		listCommits: vi.fn(async () => ({
			head: commits[0]?.hash ?? null,
			commits: [...commits],
			nextCursor: null,
		})),
		getCommit: vi.fn(async (hash: string) => {
			if (hash !== H1) throw new HistoryRequestError(404, "Commit not found");
			return { hash, commit: summary(H1), shapes: snapshot };
		}),
		diff: vi.fn(async (from: string) => ({
			from,
			to: "working",
			added: [],
			removed: snapshot,
			modified: [],
		})),
		createCommit: vi.fn(async (options = {}) => {
			created.push(options);
			const commit = summary(H2, { trigger: "manual", message: options.message ?? "" });
			commits.unshift(commit);
			return commit;
		}),
	};
}

describe("createHistoryClient", () => {
	function recordingFetch(response: unknown, status = 200) {
		const calls: { url: string; init: RequestInit }[] = [];
		const fetchFn = (async (url: string, init: RequestInit) => {
			calls.push({ url, init });
			return new Response(JSON.stringify(response), { status });
		}) as unknown as typeof fetch;
		return { calls, fetchFn };
	}

	it("builds history URLs under the board and sends credentials + headers", async () => {
		const { calls, fetchFn } = recordingFetch({ head: null, commits: [], nextCursor: null });
		const client = createHistoryClient({
			apiUrl: "https://api.test",
			boardId: "board 1",
			extraHeaders: { "X-User-Id": "u1" },
			fetch: fetchFn,
		});
		await client.listCommits({ limit: 10, cursor: "history:log:1" });
		await client.diff(H1);
		await client.diff(H1, H2);
		await client.getCommit(H1);

		expect(calls.map((c) => c.url)).toEqual([
			"https://api.test/api/boards/board%201/history?limit=10&cursor=history%3Alog%3A1",
			`https://api.test/api/boards/board%201/history/diff?from=${H1}`,
			`https://api.test/api/boards/board%201/history/diff?from=${H1}&to=${H2}`,
			`https://api.test/api/boards/board%201/history/commits/${H1}`,
		]);
		expect(calls[0]?.init.credentials).toBe("include");
		expect(calls[0]?.init.headers).toEqual({ "X-User-Id": "u1" });
	});

	it("asks for the given page's shapes and diffs on a board with pages", async () => {
		const { calls, fetchFn } = recordingFetch({});
		const client = createHistoryClient({
			apiUrl: "https://api.test",
			boardId: "b",
			pageId: "p2",
			fetch: fetchFn,
		});
		await client.listCommits();
		await client.diff(H1, H2);
		await client.getCommit(H1);
		expect(calls.map((c) => c.url)).toEqual([
			"https://api.test/api/boards/b/history",
			`https://api.test/api/boards/b/history/diff?from=${H1}&to=${H2}&page=p2`,
			`https://api.test/api/boards/b/history/commits/${H1}?page=p2`,
		]);
	});

	it("posts a commit as JSON and unwraps the response", async () => {
		const { calls, fetchFn } = recordingFetch({ commit: summary(H2) }, 201);
		const client = createHistoryClient({
			apiUrl: "https://api.test",
			boardId: "b",
			fetch: fetchFn,
		});
		const commit = await client.createCommit({ message: "v1" });
		expect(commit.hash).toBe(H2);
		expect(calls[0]?.init.method).toBe("POST");
		expect(calls[0]?.init.body).toBe(JSON.stringify({ message: "v1" }));
		expect(calls[0]?.init.headers).toEqual({ "Content-Type": "application/json" });
	});

	it("throws HistoryRequestError with the server's message", async () => {
		const { fetchFn } = recordingFetch({ error: "Forbidden" }, 403);
		const client = createHistoryClient({
			apiUrl: "https://api.test",
			boardId: "b",
			fetch: fetchFn,
		});
		await expect(client.createCommit()).rejects.toMatchObject({
			status: 403,
			message: "Forbidden",
		});
	});
});

describe("restoreShapes / restoreCommit", () => {
	it("restores as one undoable command and skips no-op restores", () => {
		const store = fakeStore([shape("a", { x: 5 }), shape("extra")]);
		const commands = fakeCommands();
		const plan = restoreShapes(store, commands, [shape("a"), shape("b")]);

		expect(plan.add.map((s) => s.id)).toEqual(["b"]);
		expect(plan.remove).toEqual(["extra"]);
		expect([...store.getShapes().keys()].sort()).toEqual(["a", "b"]);
		expect(commands.done).toHaveLength(1);

		commands.undo();
		expect([...store.getShapes().keys()].sort()).toEqual(["a", "extra"]);
		expect(store.getShape("a")?.x).toBe(5);

		const again = fakeCommands();
		restoreShapes(fakeStore([shape("a")]), again, [shape("a")]);
		expect(again.done).toHaveLength(0);
	});

	it("only touches the given ids", () => {
		const store = fakeStore([shape("a", { x: 5 }), shape("b", { x: 5 })]);
		restoreShapes(store, fakeCommands(), [shape("a"), shape("b")], { ids: ["a"] });
		expect(store.getShape("a")?.x).toBe(0);
		expect(store.getShape("b")?.x).toBe(5);
	});

	it("saves the current board before restoring a commit", async () => {
		const store = fakeStore([shape("new")]);
		const client = fakeClient([shape("old")]);
		const result = await restoreCommit({ store, commands: fakeCommands(), client }, H1);

		expect(client.created).toEqual([{ message: "1111111 に戻す前", trigger: "manual" }]);
		expect(result.backup?.hash).toBe(H2);
		expect([...store.getShapes().keys()]).toEqual(["old"]);
	});

	it("does not save a backup when the board already matches", async () => {
		const client = fakeClient([shape("a")]);
		const result = await restoreCommit(
			{ store: fakeStore([shape("a")]), commands: fakeCommands(), client },
			H1,
		);
		expect(result.backup).toBeNull();
		expect(client.created).toEqual([]);
	});
});

describe("createHistoryController", () => {
	function setup(board: ShapeData[] = [shape("now")], snapshot: ShapeData[] = [shape("old")]) {
		const store = fakeStore(board);
		const commands = fakeCommands();
		const events = fakeEvents();
		const client = fakeClient(snapshot);
		const controller = createHistoryController({ client, store, commands, events });
		return { store, commands, events, client, controller };
	}

	it("loads commits and notifies subscribers", async () => {
		const { controller } = setup();
		const listener = vi.fn();
		controller.subscribe(listener);
		await controller.refresh();
		expect(controller.getState().commits.map((c) => c.hash)).toEqual([H1]);
		expect(controller.getState().head).toBe(H1);
		expect(controller.getState().loading).toBe(false);
		expect(listener).toHaveBeenCalled();
	});

	it("saves a version and reloads the list", async () => {
		const { controller, client } = setup();
		const saved = await controller.saveVersion("  milestone  ");
		expect(saved?.hash).toBe(H2);
		expect(client.created).toEqual([{ message: "milestone" }]);
		expect(controller.getState().commits.map((c) => c.hash)).toEqual([H2, H1]);
		expect(controller.getState().notice).toBe("版を保存しました");
	});

	it("selects a commit to show its diff, and toggles it off", async () => {
		const { controller } = setup();
		await controller.select(H1);
		expect(controller.getState().selected).toBe(H1);
		expect(controller.getState().diff?.removed.map((s) => s.id)).toEqual(["old"]);
		await controller.select(H1);
		expect(controller.getState().selected).toBeNull();
		expect(controller.getState().diff).toBeNull();
	});

	it("previews a commit through the time-travel events and exits", async () => {
		const { controller, events } = setup();
		await controller.preview(H1);
		expect(controller.getState().previewing).toBe(H1);
		const [enter] = events.emitted;
		expect(enter).toMatchObject({ event: "time-travel:enter" });
		const { shapes } = enter.data as { shapes: Map<string, ShapeData> };
		expect([...shapes.keys()]).toEqual(["old"]);

		controller.exitPreview();
		expect(events.emitted[1]?.event).toBe("time-travel:exit");
		expect(controller.getState().previewing).toBeNull();
	});

	it("restores a commit, leaves preview first, and keeps the notice after reloading", async () => {
		const { controller, store, events, commands } = setup();
		await controller.preview(H1);
		const changed = await controller.restore(H1);

		expect(changed).toBe(true);
		expect(events.emitted.map((e) => e.event)).toEqual(["time-travel:enter", "time-travel:exit"]);
		expect([...store.getShapes().keys()]).toEqual(["old"]);
		expect(commands.done).toHaveLength(1);
		expect(controller.getState().notice).toContain("1111111 に戻しました");
		expect(controller.getState().commits.map((c) => c.hash)).toEqual([H2, H1]);
	});

	it("shows a readable error when a request fails", async () => {
		const { controller } = setup();
		await controller.preview("f".repeat(64));
		expect(controller.getState().error).toBe("履歴が見つかりません");
		expect(controller.getState().previewing).toBeNull();
		expect(controller.getState().loading).toBe(false);
	});
});
