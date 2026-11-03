import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { CHUNK_BYTES, deleteChunked, readChunked, writeChunked } from "../chunked-storage.js";
import { createPartitionManager, partitionStateKey } from "../partition-manager.js";
import { createSnapshotManager } from "../snapshot-manager.js";
import { compactUpdates } from "../update-compaction.js";
import { createYjsSync, LEGACY_UPDATES_KEY, MAX_SAVE_RETRIES, STATE_KEY } from "../yjs-sync.js";

/** Many more edits than the old 500-entry compaction threshold. */
const EDITS = 600;

/** Minimal in-memory stand-in for DurableObjectStorage (get/put/delete, single and batch). */
function fakeStorage() {
	const map = new Map<string, unknown>();
	const storage = {
		get: async (key: string | string[]) => {
			if (!Array.isArray(key)) return map.get(key);
			const out = new Map<string, unknown>();
			for (const k of key) if (map.has(k)) out.set(k, map.get(k));
			return out;
		},
		put: async (key: string | Record<string, unknown>, value?: unknown) => {
			if (typeof key === "string") map.set(key, value);
			else for (const [k, v] of Object.entries(key)) map.set(k, v);
		},
		list: async ({ prefix }: { prefix: string }) =>
			new Map(
				[...map].filter(([k]) => k.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b)),
			),
		delete: async (key: string | string[]) => {
			if (!Array.isArray(key)) return map.delete(key);
			let n = 0;
			for (const k of key) if (map.delete(k)) n++;
			return n;
		},
	} as unknown as DurableObjectStorage;
	return { storage, map };
}

/**
 * A client doc that creates one shape first, then edits another shape `edits`
 * times. Every Yjs update is handed to `onUpdate`, like the WebSocket path.
 */
function editBoard(edits: number, onUpdate: (u: Uint8Array) => void): void {
	const client = new Y.Doc();
	client.on("update", (u: Uint8Array) => onUpdate(u));
	const shapes = client.getMap<Record<string, unknown>>("shapes");
	shapes.set("first", { id: "first", x: 0 });
	for (let i = 0; i < edits; i++) shapes.set("moving", { id: "moving", x: i });
}

/** Build a fresh doc from the given updates, like a newly connecting client. */
function docFrom(updates: readonly Uint8Array[]): Y.Map<Record<string, unknown>> {
	const doc = new Y.Doc();
	for (const u of updates) Y.applyUpdate(doc, u);
	return doc.getMap<Record<string, unknown>>("shapes");
}

describe("createYjsSync", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("keeps the first shape after many updates", async () => {
		const { storage } = fakeStorage();
		const sync = createYjsSync({ storage });
		await sync.loadUpdates();
		editBoard(EDITS, (u) => sync.pushUpdate(u));

		const shapes = docFrom(sync.getUpdates());
		expect(shapes.get("first")).toEqual({ id: "first", x: 0 });
		expect(shapes.get("moving")).toEqual({ id: "moving", x: EDITS - 1 });
	});

	it("saves one binary state and a reloaded room still has every shape", async () => {
		const { storage, map } = fakeStorage();
		const sync = createYjsSync({ storage });
		await sync.loadUpdates();
		editBoard(EDITS, (u) => sync.pushUpdate(u));

		sync.scheduleSave();
		await vi.runAllTimersAsync();
		expect(sync.getUpdates()).toHaveLength(1);
		expect(map.has(LEGACY_UPDATES_KEY)).toBe(false);
		expect(await readChunked(storage, STATE_KEY)).toBeInstanceOf(Uint8Array);

		// Cold start: a new room instance reads only what was persisted.
		const reloaded = createYjsSync({ storage });
		await reloaded.loadUpdates();
		const shapes = docFrom(reloaded.getUpdates());
		expect(shapes.get("first")).toEqual({ id: "first", x: 0 });
		expect(shapes.get("moving")).toEqual({ id: "moving", x: EDITS - 1 });
	});

	it("drops overwritten values, so repeated edits do not grow the saved state", async () => {
		const sizeAfter = async (edits: number) => {
			const sync = createYjsSync({ storage: fakeStorage().storage });
			await sync.loadUpdates();
			editBoard(edits, (u) => sync.pushUpdate(u));
			await sync.save();
			return sync.getUpdates()[0].length;
		};
		const few = await sizeAfter(10);
		const many = await sizeAfter(EDITS);
		// Each edit leaves only a few bytes of bookkeeping, not the old value.
		expect(many - few).toBeLessThan(EDITS * 8);
	});

	it("migrates a board saved in the old JSON format and removes the old key", async () => {
		const { storage, map } = fakeStorage();
		const legacy: Uint8Array[] = [];
		editBoard(5, (u) => legacy.push(u));
		map.set(LEGACY_UPDATES_KEY, JSON.stringify(legacy.map((u) => Array.from(u))));

		const sync = createYjsSync({ storage });
		await sync.loadUpdates();
		expect(docFrom(sync.getUpdates()).get("moving")).toEqual({ id: "moving", x: 4 });

		sync.pushUpdate(legacy[0]);
		sync.scheduleSave();
		await vi.runAllTimersAsync();
		expect(map.has(LEGACY_UPDATES_KEY)).toBe(false);

		const reloaded = createYjsSync({ storage });
		await reloaded.loadUpdates();
		expect(docFrom(reloaded.getUpdates()).get("first")).toEqual({ id: "first", x: 0 });
	});

	it("does not lose updates pushed while compaction is in flight", async () => {
		const { storage } = fakeStorage();
		const sync = createYjsSync({ storage });
		await sync.loadUpdates();
		const client = new Y.Doc();
		client.on("update", (u: Uint8Array) => sync.pushUpdate(u));
		const shapes = client.getMap<Record<string, unknown>>("shapes");
		for (let i = 0; i < EDITS; i++) shapes.set(`s${i}`, { id: `s${i}` });

		const compacting = sync.compact();
		shapes.set("late", { id: "late" });
		await compacting;

		const result = docFrom(sync.getUpdates());
		expect(result.has("s0")).toBe(true);
		expect(result.has("late")).toBe(true);
	});

	it("saves again when updates arrive during a save", async () => {
		const { storage } = fakeStorage();
		const sync = createYjsSync({ storage });
		await sync.loadUpdates();
		const client = new Y.Doc();
		client.on("update", (u: Uint8Array) => {
			sync.pushUpdate(u);
			sync.scheduleSave();
		});
		const shapes = client.getMap<Record<string, unknown>>("shapes");
		shapes.set("a", { id: "a" });

		await vi.advanceTimersByTimeAsync(5000); // first save starts
		shapes.set("b", { id: "b" }); // arrives while it runs
		await vi.runAllTimersAsync();

		const reloaded = createYjsSync({ storage });
		await reloaded.loadUpdates();
		expect(docFrom(reloaded.getUpdates()).has("b")).toBe(true);
	});

	it("fails to load instead of starting empty when the saved state is broken", async () => {
		const { storage, map } = fakeStorage();
		const sync = createYjsSync({ storage });
		await sync.loadUpdates();
		editBoard(3, (u) => sync.pushUpdate(u));
		await sync.save();
		for (const key of [...map.keys()]) if (key.includes(":g")) map.delete(key);

		await expect(createYjsSync({ storage }).loadUpdates()).rejects.toThrow();
	});
});

describe("createYjsSync save failures", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("stops retrying after a few failed saves until the next update", async () => {
		const { storage } = fakeStorage();
		const put = vi.spyOn(storage, "put").mockRejectedValue(new Error("quota"));
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const sync = createYjsSync({ storage });
		await sync.loadUpdates();
		editBoard(1, (u) => sync.pushUpdate(u));
		sync.scheduleSave();
		await vi.runAllTimersAsync();
		expect(put).toHaveBeenCalledTimes(MAX_SAVE_RETRIES);
		errorSpy.mockRestore();
	});
});

describe("chunked storage", () => {
	const bytes = (n: number) => Uint8Array.from({ length: n }, (_, i) => i % 251);

	it("round-trips a value larger than one chunk", async () => {
		const { storage } = fakeStorage();
		const data = bytes(CHUNK_BYTES * 2 + 17);
		await writeChunked(storage, "k", data);
		expect(await readChunked(storage, "k")).toEqual(data);
	});

	it("removes the previous generation's chunks on rewrite, and everything on delete", async () => {
		const { storage, map } = fakeStorage();
		await writeChunked(storage, "k", bytes(CHUNK_BYTES * 3));
		await writeChunked(storage, "k", bytes(10));
		expect([...map.keys()].filter((k) => k.startsWith("k:")).sort()).toEqual(["k:g2:0", "k:meta"]);
		expect(await readChunked(storage, "k")).toEqual(bytes(10));

		await deleteChunked(storage, "k");
		expect(map.size).toBe(0);
		expect(await readChunked(storage, "k")).toBeUndefined();
	});

	it("rejects inconsistent meta on read and replaces it on write", async () => {
		const { storage, map } = fakeStorage();
		map.set("k:meta", { gen: 1, length: -1, chunks: 1 });
		await expect(readChunked(storage, "k")).rejects.toThrow(/malformed/);
		map.set("k:meta", { gen: 1, length: 10, chunks: 0 });
		await expect(readChunked(storage, "k")).rejects.toThrow(/malformed/);
		await writeChunked(storage, "k", bytes(3));
		expect(await readChunked(storage, "k")).toEqual(bytes(3));
	});

	it("also removes chunks an interrupted earlier cleanup left behind", async () => {
		const { storage, map } = fakeStorage();
		await writeChunked(storage, "k", bytes(10));
		map.set("k:g0:0", bytes(5)); // left over from an older generation
		map.set("k2:g1:0", bytes(5)); // another value whose key starts with "k"
		await writeChunked(storage, "k", bytes(20));
		expect([...map.keys()].sort()).toEqual(["k2:g1:0", "k:g2:0", "k:meta"]);
	});
});

describe("compactUpdates", () => {
	it("returns nothing for no updates", async () => {
		expect(await compactUpdates([])).toEqual([]);
	});

	it("skips a corrupt update and keeps the rest", async () => {
		const good: Uint8Array[] = [];
		editBoard(2, (u) => good.push(u));
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const result = await compactUpdates([new Uint8Array([255, 255, 255]), ...good]);
		errorSpy.mockRestore();
		expect(result).toHaveLength(1);
		expect(docFrom(result).get("moving")).toEqual({ id: "moving", x: 1 });
	});
});

describe("createPartitionManager", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("compacts a partition without dropping its early updates", async () => {
		const { storage } = fakeStorage();
		const partitions = createPartitionManager({ storage });
		await partitions.loadFromStorage();
		vi.useFakeTimers();
		editBoard(EDITS, (u) => partitions.trackUpdate(u));
		const name = partitions.getCurrentPartitionName();
		await partitions.compactPartition(name);

		const updates = partitions.getPartitionUpdates(name) ?? [];
		expect(updates).toHaveLength(1);
		expect(docFrom(updates).get("first")).toEqual({ id: "first", x: 0 });
	});

	it("still loads other partitions when one can't be read, and never overwrites it", async () => {
		const { storage, map } = fakeStorage();
		vi.useFakeTimers();
		const name = createPartitionManager({ storage }).getCurrentPartitionName();
		map.set(
			"partition_meta",
			JSON.stringify({
				partitions: ["shapes:2020-Q1", name],
				activePartition: name,
				shapeCount: {},
			}),
		);
		map.set(`${partitionStateKey("shapes:2020-Q1")}:meta`, { gen: 1, length: 10, chunks: 1 });
		const good: Uint8Array[] = [];
		editBoard(2, (u) => good.push(u));
		await writeChunked(storage, partitionStateKey(name), good[1]);
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const partitions = createPartitionManager({ storage });
		await partitions.loadFromStorage();
		expect(partitions.getPartitionUpdates(name)).toHaveLength(1);
		await partitions.savePartition("shapes:2020-Q1");
		expect(map.get(`${partitionStateKey("shapes:2020-Q1")}:meta`)).toEqual({
			gen: 1,
			length: 10,
			chunks: 1,
		});
		errorSpy.mockRestore();
	});

	it("saves a partition as binary and reloads it, migrating the old key", async () => {
		const { storage, map } = fakeStorage();
		vi.useFakeTimers();
		const name = createPartitionManager({ storage }).getCurrentPartitionName();
		const legacy: Uint8Array[] = [];
		editBoard(3, (u) => legacy.push(u));
		map.set(
			"partition_meta",
			JSON.stringify({ partitions: [name], activePartition: name, shapeCount: {} }),
		);
		map.set(`yjs_updates:${name}`, JSON.stringify(legacy.map((u) => Array.from(u))));

		const partitions = createPartitionManager({ storage });
		await partitions.loadFromStorage();
		partitions.trackUpdate(legacy[0]);
		await vi.runAllTimersAsync();
		expect(map.has(`yjs_updates:${name}`)).toBe(false);
		expect(await readChunked(storage, partitionStateKey(name))).toBeInstanceOf(Uint8Array);

		const reloaded = createPartitionManager({ storage });
		await reloaded.loadFromStorage();
		expect(docFrom(reloaded.getPartitionUpdates(name) ?? []).get("moving")).toEqual({
			id: "moving",
			x: 2,
		});
	});
});

describe("createSnapshotManager", () => {
	it("returns the shapes as they were when the snapshot was taken", async () => {
		const { storage } = fakeStorage();
		const doc = new Y.Doc();
		const shapes = doc.getMap<Record<string, unknown>>("shapes");
		shapes.set("a", { id: "a", x: 1 });
		const snapshots = createSnapshotManager({
			storage,
			getOrCreateDoc: async () => ({ doc }),
			getWebSockets: () => [],
		});

		const created = (await (await snapshots.handleCreateSnapshot()).json()) as {
			timestamp: number;
		};
		shapes.set("a", { id: "a", x: 2 });
		shapes.set("b", { id: "b", x: 0 });

		const res = await snapshots.handleGetSnapshot(String(created.timestamp));
		expect(res.status).toBe(200);
		expect((await snapshots.handleGetSnapshot("1")).status).toBe(404);
		await storage.put("snapshot:2", [0]);
		expect((await snapshots.handleGetSnapshot("2")).status).toBe(410);
		expect(((await res.json()) as { shapes: unknown[] }).shapes).toEqual([{ id: "a", x: 1 }]);
	});
});
