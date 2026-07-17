import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createPortalStore, defaultPortalBox } from "../portal-store.js";

function memStorage() {
	const m = new Map<string, string>();
	return {
		store: {
			getItem: (k: string) => m.get(k) ?? null,
			setItem: (k: string, v: string) => void m.set(k, v),
		},
		raw: m,
	};
}

const box = { x: 10, y: 20, w: 200, h: 150 };

describe("createPortalStore", () => {
	it("adds/removes private portals and persists to storage", () => {
		const { store: storage, raw } = memStorage();
		const doc = new Y.Doc();
		const s = createPortalStore({ doc, userId: "u1", boardId: "b1", storage });

		const e = s.add("shape-1", box);
		expect(s.getAll()).toHaveLength(1);
		expect(s.getAll()[0]).toMatchObject({ shared: false, entry: { shapeId: "shape-1", x: 10 } });
		// persisted under the per-user key
		expect(raw.get("usketch:portals:b1:u1")).toContain("shape-1");

		s.remove(e.id);
		expect(s.getAll()).toHaveLength(0);
	});

	it("reloads private portals from storage", () => {
		const { store: storage } = memStorage();
		const doc = new Y.Doc();
		createPortalStore({ doc, userId: "u1", storage }).add("shape-x", box);
		// A fresh store over the same storage sees the persisted portal.
		const s2 = createPortalStore({ doc: new Y.Doc(), userId: "u1", storage });
		expect(s2.getAll().map((it) => it.entry.shapeId)).toEqual(["shape-x"]);
	});

	it("update mutates position/size", () => {
		const s = createPortalStore({ doc: new Y.Doc(), userId: "u", storage: memStorage().store });
		const e = s.add("s", box);
		s.update(e.id, { x: 99, w: 300 });
		expect(s.getAll()[0].entry).toMatchObject({ x: 99, w: 300, y: 20 });
	});

	it("setShared moves an entry between private and the shared Y.Map (keeping id)", () => {
		const doc = new Y.Doc();
		const s = createPortalStore({ doc, userId: "u", boardId: "b", storage: memStorage().store });
		const e = s.add("s", box);
		expect(doc.getMap("portals").size).toBe(0);

		s.setShared(e.id, true);
		expect(doc.getMap("portals").has(e.id)).toBe(true);
		expect(s.getAll()).toHaveLength(1);
		expect(s.getAll()[0].shared).toBe(true);

		s.setShared(e.id, false);
		expect(doc.getMap("portals").has(e.id)).toBe(false);
		expect(s.getAll()[0].shared).toBe(false);
	});

	it("reflects remote shared portals via observe", () => {
		const doc = new Y.Doc();
		const s = createPortalStore({ doc, userId: "u", storage: memStorage().store });
		let notified = 0;
		s.subscribe(() => notified++);
		// Simulate a remote client writing into the shared map.
		doc.getMap("portals").set("p1", { id: "p1", shapeId: "s9", x: 0, y: 0, w: 100, h: 100 });
		expect(notified).toBeGreaterThan(0);
		expect(s.getAll().find((it) => it.entry.id === "p1")?.shared).toBe(true);
	});

	it("clearPrivate removes only private portals", () => {
		const doc = new Y.Doc();
		const s = createPortalStore({ doc, userId: "u", storage: memStorage().store });
		const a = s.add("a", box);
		s.add("b", box);
		s.setShared(a.id, true); // a → shared
		s.clearPrivate();
		expect(s.getAll().map((it) => it.entry.shapeId)).toEqual(["a"]); // only the shared one remains
	});
});

describe("defaultPortalBox", () => {
	it("fits bounds into the max box preserving aspect, never upscaling", () => {
		const wide = defaultPortalBox({ width: 800, height: 400 }, 0, 1000);
		// 800×400 scaled to fit 260×200 → k=0.325 → 260×130 + header
		expect(wide.w).toBe(260);
		expect(wide.h).toBe(130 + 30);
	});

	it("cascades from the top-right by index", () => {
		const a = defaultPortalBox({ width: 100, height: 100 }, 0, 1000);
		const b = defaultPortalBox({ width: 100, height: 100 }, 1, 1000);
		expect(b.x).toBeLessThan(a.x);
		expect(b.y).toBeGreaterThan(a.y);
	});
});
