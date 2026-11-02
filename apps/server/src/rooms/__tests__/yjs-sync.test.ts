import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { createPartitionManager } from "../partition-manager.js";
import { COMPACT_THRESHOLD, compactUpdates } from "../update-compaction.js";
import { createYjsSync } from "../yjs-sync.js";

/** Minimal in-memory stand-in for DurableObjectStorage (get/put/delete only). */
function fakeStorage() {
	const map = new Map<string, unknown>();
	const storage = {
		get: async (key: string) => map.get(key),
		put: async (key: string, value: unknown) => {
			map.set(key, value);
		},
		delete: async (key: string) => map.delete(key),
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

	it("keeps the first shape after more updates than the old 500-entry cap", async () => {
		const { storage } = fakeStorage();
		const sync = createYjsSync({ storage });
		await sync.loadUpdates();
		editBoard(COMPACT_THRESHOLD + 100, (u) => sync.pushUpdate(u));

		const shapes = docFrom(sync.getUpdates());
		expect(shapes.get("first")).toEqual({ id: "first", x: 0 });
		expect(shapes.get("moving")).toEqual({ id: "moving", x: COMPACT_THRESHOLD + 99 });
	});

	it("compacts the buffer on save and a reloaded room still has every shape", async () => {
		const { storage } = fakeStorage();
		const sync = createYjsSync({ storage });
		await sync.loadUpdates();
		editBoard(COMPACT_THRESHOLD + 100, (u) => sync.pushUpdate(u));

		sync.scheduleSave();
		await vi.runAllTimersAsync();
		expect(sync.getUpdates()).toHaveLength(1);

		// Cold start: a new room instance reads only what was persisted.
		const reloaded = createYjsSync({ storage });
		await reloaded.loadUpdates();
		const shapes = docFrom(reloaded.getUpdates());
		expect(shapes.get("first")).toEqual({ id: "first", x: 0 });
		expect(shapes.get("moving")).toEqual({ id: "moving", x: COMPACT_THRESHOLD + 99 });
	});

	it("does not lose updates pushed while compaction is in flight", async () => {
		const { storage } = fakeStorage();
		const sync = createYjsSync({ storage });
		await sync.loadUpdates();
		const client = new Y.Doc();
		client.on("update", (u: Uint8Array) => sync.pushUpdate(u));
		const shapes = client.getMap<Record<string, unknown>>("shapes");
		for (let i = 0; i <= COMPACT_THRESHOLD; i++) shapes.set(`s${i}`, { id: `s${i}` });

		const compacting = sync.compact();
		shapes.set("late", { id: "late" });
		await compacting;

		const result = docFrom(sync.getUpdates());
		expect(result.has("s0")).toBe(true);
		expect(result.has("late")).toBe(true);
	});
});

describe("compactUpdates", () => {
	it("returns the input unchanged at or under the threshold", async () => {
		const updates = [new Uint8Array([1]), new Uint8Array([2])];
		expect(await compactUpdates(updates, 2)).toEqual(updates);
	});

	it("keeps the input when an update is corrupt", async () => {
		const updates = [new Uint8Array([255, 255, 255]), new Uint8Array([1, 2, 3])];
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(await compactUpdates(updates, 1)).toEqual(updates);
		errorSpy.mockRestore();
	});
});

describe("createPartitionManager", () => {
	it("compacts a partition without dropping its early updates", async () => {
		const { storage } = fakeStorage();
		const partitions = createPartitionManager({ storage });
		await partitions.loadFromStorage();
		vi.useFakeTimers();
		try {
			editBoard(COMPACT_THRESHOLD + 100, (u) => partitions.trackUpdate(u));
			const name = partitions.getCurrentPartitionName();
			await partitions.compactPartition(name);

			const updates = partitions.getPartitionUpdates(name) ?? [];
			expect(updates).toHaveLength(1);
			expect(docFrom(updates).get("first")).toEqual({ id: "first", x: 0 });
		} finally {
			vi.useRealTimers();
		}
	});
});
