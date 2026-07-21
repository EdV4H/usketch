import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { createAssetStore, hashKey } from "../asset-store.js";

describe("hashKey", () => {
	it("is stable and distinguishes different inputs/lengths", () => {
		expect(hashKey("data:abc")).toBe(hashKey("data:abc"));
		expect(hashKey("data:abc")).not.toBe(hashKey("data:abd"));
		expect(hashKey("a")).not.toBe(hashKey("aa"));
	});
});

describe("createAssetStore", () => {
	it("upload is content-addressed and dedupes identical payloads", async () => {
		const doc = new Y.Doc();
		const store = createAssetStore(doc);
		const id1 = await store.upload("image", "data:img-1", { w: 10, h: 10 });
		const id2 = await store.upload("image", "data:img-1", { w: 10, h: 10 });
		expect(id1).toBe(id2);
		expect(doc.getMap("assets").size).toBe(1);
		expect(store.resolve(id1)).toBe("data:img-1");
		expect(store.get(id1)?.type).toBe("image");
	});

	it("different payloads get different ids", async () => {
		const store = createAssetStore(new Y.Doc());
		const a = await store.upload("image", "data:a");
		const b = await store.upload("image", "data:b");
		expect(a).not.toBe(b);
	});

	it("setUploader routes to a custom backend", async () => {
		const store = createAssetStore(new Y.Doc());
		store.setUploader(async (_t, _d) => ({ id: "cdn:1", src: "https://cdn/x.png" }));
		const id = await store.upload("image", "data:huge");
		expect(id).toBe("cdn:1");
		expect(store.resolve(id)).toBe("https://cdn/x.png");
	});

	it("setResolver transforms the resolved src", async () => {
		const store = createAssetStore(new Y.Doc());
		const id = await store.upload("image", "data:x");
		store.setResolver((r) => `${r.src}?signed`);
		expect(store.resolve(id)).toBe("data:x?signed");
	});

	it("notifies subscribers and reflects records written by another client (same doc)", async () => {
		const doc = new Y.Doc();
		const a = createAssetStore(doc);
		const cb = vi.fn();
		a.subscribe(cb);
		// Simulate a remote client on the same doc.
		const b = createAssetStore(doc);
		await b.upload("image", "data:remote");
		expect(cb).toHaveBeenCalled();
		expect([...doc.getMap("assets").keys()]).toHaveLength(1);
		expect(a.resolve(`asset:${hashKey("data:remote")}`)).toBe("data:remote");
	});
});
