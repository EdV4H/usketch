import { removeShapePermanently, type ShapeData } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
	bindPermanentRemovals,
	DEFAULT_PERMANENT_REMOVALS_MAP_KEY,
	PERMANENT_REMOVAL_ORIGIN,
} from "../permanent-removals.js";

function makeShape(id: string): ShapeData {
	return {
		id,
		type: "rectangle",
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
	};
}

function setup() {
	const store = createBoardStore();
	const doc = new Y.Doc();
	const shapes = doc.getMap<unknown>("shapes");
	const removals = doc.getMap<boolean>(DEFAULT_PERMANENT_REMOVALS_MAP_KEY);
	const unbind = bindPermanentRemovals(store, doc);
	return { store, doc, shapes, removals, unbind };
}

describe("bindPermanentRemovals", () => {
	it("records a local removal and deletes the shape in one transaction with its own origin", () => {
		const { store, doc, shapes, removals } = setup();
		store.addShape(makeShape("a"));
		shapes.set("a", makeShape("a"));
		const origins: unknown[] = [];
		doc.on("afterTransaction", (txn: Y.Transaction) => origins.push(txn.origin));

		removeShapePermanently(store, "a");

		expect(removals.get("a")).toBe(true);
		expect(shapes.has("a")).toBe(false);
		expect(origins).toEqual([PERMANENT_REMOVAL_ORIGIN]);
	});

	it("removes ids recorded by someone else from the store", () => {
		const { store, removals } = setup();
		store.addShape(makeShape("a"));
		removals.set("a", true);
		expect(store.getShape("a")).toBeUndefined();
		expect(store.isPermanentlyRemoved?.("a")).toBe(true);
	});

	it("reads the existing records when bound, and cleans up shapes left behind", () => {
		const store = createBoardStore();
		const doc = new Y.Doc();
		doc.getMap<boolean>(DEFAULT_PERMANENT_REMOVALS_MAP_KEY).set("a", true);
		doc.getMap("shapes").set("a", makeShape("a"));
		bindPermanentRemovals(store, doc);
		expect(store.isPermanentlyRemoved?.("a")).toBe(true);
		expect(doc.getMap("shapes").has("a")).toBe(false);
	});

	it("deletes a recorded id that comes back into the shapes map", () => {
		const { store, shapes } = setup();
		removeShapePermanently(store, "a");
		shapes.set("a", makeShape("a"));
		expect(shapes.has("a")).toBe(false);
	});

	it("doesn't write records that arrived from the doc back into it", () => {
		const { removals, doc } = setup();
		let writes = 0;
		doc.on("afterTransaction", () => {
			writes++;
		});
		removals.set("a", true);
		expect(writes).toBe(1);
	});

	it("lets a read-only viewer receive records", () => {
		const { store, removals } = setup();
		store.addShape(makeShape("a"));
		store.setReadOnly?.(true);
		removals.set("a", true);
		expect(store.getShape("a")).toBeUndefined();
		expect(store.isPermanentlyRemoved?.("a")).toBe(true);
	});

	it("stops after unbinding", () => {
		const { store, removals, unbind } = setup();
		unbind();
		removeShapePermanently(store, "a");
		expect(removals.has("a")).toBe(false);
		store.addShape(makeShape("b"));
		removals.set("b", true);
		expect(store.getShape("b")).toBeDefined();
	});

	it("honours custom map keys", () => {
		const store = createBoardStore();
		const doc = new Y.Doc();
		bindPermanentRemovals(store, doc, { shapesMapKey: "map", removalsMapKey: "gone" });
		doc.getMap("map").set("a", makeShape("a"));
		removeShapePermanently(store, "a");
		expect(doc.getMap("gone").get("a")).toBe(true);
		expect(doc.getMap("map").has("a")).toBe(false);
	});
});
