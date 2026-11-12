import { describe, expect, it } from "vitest";
import { writeChunked } from "../chunked-storage.js";
import { deleteLegacySnapshots } from "../legacy-snapshot-cleanup.js";

/** In-memory DurableObjectStorage with list (prefix + limit) and batch delete (≤128 keys). */
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
		list: async ({ prefix, limit }: { prefix: string; limit?: number }) => {
			const keys = [...map.keys()].filter((k) => k.startsWith(prefix)).sort();
			return new Map(keys.slice(0, limit ?? keys.length).map((k) => [k, map.get(k)]));
		},
		delete: async (key: string | string[]) => {
			if (!Array.isArray(key)) return map.delete(key);
			if (key.length > 128) throw new Error("too many keys");
			let n = 0;
			for (const k of key) if (map.delete(k)) n++;
			return n;
		},
	} as unknown as DurableObjectStorage;
	return { storage, map };
}

describe("deleteLegacySnapshots", () => {
	it("removes every old snapshot key and leaves the board and history alone", async () => {
		const { storage, map } = fakeStorage();
		// Board state and history that must survive.
		await writeChunked(storage, "yjs_state", new Uint8Array([1, 2, 3]));
		map.set("history:ref:main", "abc");
		map.set("history:object:abc", "commit {}");
		map.set("sessions", {});
		// Old Time Travel data: 150 chunked states (more than one delete batch),
		// one pre-chunking Y.snapshot entry and the index.
		for (let ts = 1; ts <= 150; ts++) {
			await writeChunked(storage, `snapshot_state:${ts}`, new Uint8Array([ts % 256]));
		}
		map.set("snapshot:7", [0, 1]);
		map.set("snapshots:index", "[]");

		const deleted = await deleteLegacySnapshots(storage);

		expect(deleted).toBe(150 * 2 + 2);
		expect([...map.keys()].filter((k) => k.startsWith("snapshot"))).toEqual([]);
		expect(map.get("history:ref:main")).toBe("abc");
		expect(map.has("sessions")).toBe(true);
		expect([...map.keys()].some((k) => k.startsWith("yjs_state"))).toBe(true);
	});

	it("does nothing when there is no old data", async () => {
		const { storage } = fakeStorage();
		expect(await deleteLegacySnapshots(storage)).toBe(0);
	});
});
