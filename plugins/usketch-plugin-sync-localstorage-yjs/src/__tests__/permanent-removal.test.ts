import {
	isPermanentlyRemoved,
	removeShapePermanently,
	type ShapeData,
} from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createYjsSync, type YjsSyncHandle } from "../yjs-sync.js";

function makeShape(id: string): ShapeData {
	return {
		id,
		type: "skewer",
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
	};
}

describe("createYjsSync — permanent removal", () => {
	const handles: YjsSyncHandle[] = [];
	afterEach(() => {
		while (handles.length) handles.pop()?.destroy();
	});

	function client(doc: Y.Doc) {
		const store = createBoardStore();
		let permanent = 0;
		store.onMutation((event) => {
			if (event.type === "shape:removed" && event.payload.permanent) permanent++;
		});
		handles.push(createYjsSync(store, { doc, persist: false }));
		return { store, doc, permanentCount: () => permanent };
	}

	function pair() {
		const docA = new Y.Doc();
		const docB = new Y.Doc();
		docA.on("update", (u: Uint8Array, origin: unknown) => {
			if (origin !== "peer") Y.applyUpdate(docB, u, "peer");
		});
		docB.on("update", (u: Uint8Array, origin: unknown) => {
			if (origin !== "peer") Y.applyUpdate(docA, u, "peer");
		});
		return { a: client(docA), b: client(docB) };
	}

	it("removes it on both clients and keeps it gone", () => {
		const { a, b } = pair();
		a.store.addShape(makeShape("s"));
		removeShapePermanently(a.store, "s");

		for (const c of [a, b]) {
			expect(c.store.getShape("s")).toBeUndefined();
			expect(c.doc.getMap("shapes").has("s")).toBe(false);
			expect(c.permanentCount()).toBe(1);
		}
		b.doc.getMap("shapes").set("s", makeShape("s"));
		expect(a.store.getShape("s")).toBeUndefined();
		expect(b.store.getShape("s")).toBeUndefined();
	});

	it("keeps it gone after a reload from the saved doc", () => {
		const { a } = pair();
		a.store.addShape(makeShape("s"));
		removeShapePermanently(a.store, "s");

		const reloaded = new Y.Doc();
		Y.applyUpdate(reloaded, Y.encodeStateAsUpdate(a.doc));
		const c = client(reloaded);
		expect(c.store.getShape("s")).toBeUndefined();
		expect(isPermanentlyRemoved(c.store, "s")).toBe(true);
	});
});
