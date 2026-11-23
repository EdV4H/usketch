import { applyExternal, isReadOnly, type ShapeData, type StoreEvent } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { createBoardStore } from "../board-store.js";

function makeShape(id: string): ShapeData {
	return {
		id,
		type: "rectangle",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
	};
}

describe("BoardStore read-only", () => {
	it("starts writable", () => {
		expect(isReadOnly(createBoardStore())).toBe(false);
	});

	it("drops the viewer's own shape writes while read-only", () => {
		const store = createBoardStore();
		store.addShape(makeShape("a"));
		store.setReadOnly?.(true);

		store.addShape(makeShape("b"));
		store.updateShape("a", { x: 50 });
		store.deleteShape("a");

		expect(store.getShape("b")).toBeUndefined();
		expect(store.getShape("a")?.x).toBe(0);
	});

	it("lets external changes (sync, loading) through", () => {
		const store = createBoardStore();
		store.setReadOnly?.(true);
		applyExternal(store, () => {
			store.addShape(makeShape("a"));
			store.updateShape("a", { x: 10 });
		});
		expect(store.getShape("a")?.x).toBe(10);
		applyExternal(store, () => store.deleteShape("a"));
		expect(store.getShape("a")).toBeUndefined();
		// Outside it, writes are dropped again.
		store.addShape(makeShape("b"));
		expect(store.getShape("b")).toBeUndefined();
	});

	it("keeps viewer-local state (selection, tool, viewport) writable", () => {
		const store = createBoardStore();
		applyExternal(store, () => store.addShape(makeShape("a")));
		store.setReadOnly?.(true);
		store.setSelection(["a"]);
		store.setActiveToolId("pan");
		store.panBy(10, 0);
		expect([...store.getSelection()]).toEqual(["a"]);
		expect(store.getActiveToolId()).toBe("pan");
		expect(store.getViewport().x).toBe(10);
	});

	it("tells listeners when it changes", () => {
		const store = createBoardStore();
		const events: StoreEvent[] = [];
		let notified = 0;
		store.onMutation((e) => events.push(e));
		store.subscribe(() => notified++);
		store.setReadOnly?.(true);
		store.setReadOnly?.(true);
		store.setReadOnly?.(false);
		expect(events.filter((e) => e.type === "read-only:changed")).toEqual([
			{ type: "read-only:changed", payload: { readOnly: true } },
			{ type: "read-only:changed", payload: { readOnly: false } },
		]);
		expect(notified).toBe(2);
	});
});
