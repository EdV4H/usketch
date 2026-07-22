import type { ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { createBoardStore } from "../board-store.js";
import { createSetHiddenCommand, createSetLockedCommand } from "../commands.js";
import { isEffectivelyHidden, isEffectivelyLocked } from "../hierarchy-utils.js";

function makeShape(overrides: Partial<ShapeData> = {}): ShapeData {
	return {
		id: overrides.id ?? "s1",
		type: overrides.type ?? "rectangle",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
		...overrides,
	};
}

describe("hidden / locked base logic", () => {
	describe("isEffectivelyHidden / isEffectivelyLocked", () => {
		it("returns own flag when there is no parent", () => {
			const store = createBoardStore();
			const hidden = makeShape({ id: "h", hidden: true });
			const locked = makeShape({ id: "l", locked: true });
			const plain = makeShape({ id: "p" });
			store.addShape(hidden);
			store.addShape(locked);
			store.addShape(plain);

			expect(isEffectivelyHidden(store, hidden)).toBe(true);
			expect(isEffectivelyLocked(store, locked)).toBe(true);
			expect(isEffectivelyHidden(store, plain)).toBe(false);
			expect(isEffectivelyLocked(store, plain)).toBe(false);
		});

		it("cascades from an ancestor to descendants", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "group", type: "group", hidden: true, locked: true }));
			store.addShape(makeShape({ id: "child", parentId: "group" }));
			store.addShape(makeShape({ id: "grandchild", parentId: "child" }));

			const child = store.getShape("child")!;
			const grandchild = store.getShape("grandchild")!;
			expect(isEffectivelyHidden(store, child)).toBe(true);
			expect(isEffectivelyHidden(store, grandchild)).toBe(true);
			expect(isEffectivelyLocked(store, child)).toBe(true);
			expect(isEffectivelyLocked(store, grandchild)).toBe(true);
		});

		it("is not tripped by a sibling / unrelated hidden shape", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "group" }));
			store.addShape(makeShape({ id: "child", parentId: "group" }));
			store.addShape(makeShape({ id: "other", hidden: true, locked: true }));

			const child = store.getShape("child")!;
			expect(isEffectivelyHidden(store, child)).toBe(false);
			expect(isEffectivelyLocked(store, child)).toBe(false);
		});

		it("is cycle-safe if parentId forms a loop", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "a", parentId: "b" }));
			store.addShape(makeShape({ id: "b", parentId: "a" }));

			// Neither is hidden/locked; the walk must terminate rather than loop.
			expect(isEffectivelyHidden(store, store.getShape("a")!)).toBe(false);
			expect(isEffectivelyLocked(store, store.getShape("b")!)).toBe(false);
		});
	});

	describe("createSetHiddenCommand / createSetLockedCommand", () => {
		it("sets and undoes hidden on a single shape", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1" }));

			const cmd = createSetHiddenCommand(store, ["s1"], true);
			cmd.execute();
			expect(store.getShape("s1")!.hidden).toBe(true);

			cmd.undo();
			expect(store.getShape("s1")!.hidden).toBeUndefined();
		});

		it("sets and undoes locked across multiple shapes, restoring prior values", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1" }));
			store.addShape(makeShape({ id: "s2", locked: true }));

			const cmd = createSetLockedCommand(store, ["s1", "s2"], true);
			cmd.execute();
			expect(store.getShape("s1")!.locked).toBe(true);
			expect(store.getShape("s2")!.locked).toBe(true);

			cmd.undo();
			expect(store.getShape("s1")!.locked).toBeUndefined();
			expect(store.getShape("s2")!.locked).toBe(true); // was already locked
		});

		it("clearing writes undefined (not false) to keep state lean", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1", hidden: true }));

			const cmd = createSetHiddenCommand(store, ["s1"], false);
			cmd.execute();
			expect(store.getShape("s1")!.hidden).toBeUndefined();

			cmd.undo();
			expect(store.getShape("s1")!.hidden).toBe(true);
		});

		it("ignores unknown ids without throwing", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1" }));
			const cmd = createSetHiddenCommand(store, ["s1", "missing"], true);
			expect(() => cmd.execute()).not.toThrow();
			expect(store.getShape("s1")!.hidden).toBe(true);
		});
	});
});
