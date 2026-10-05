import type { PluginAction, PluginContext, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createPortalPlugin } from "../plugin.js";

function rect(id: string): ShapeData {
	return {
		id,
		type: "rect",
		x: 10,
		y: 20,
		width: 100,
		height: 60,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
	} as ShapeData;
}

/** Mock ctx: real in-memory board store + action registry + undo-stack commands. */
function harness() {
	const shapes = new Map<string, ShapeData>();
	const selection = new Set<string>();
	const registered = new Map<string, PluginAction>();
	const undoStack: { undo: () => void }[] = [];
	const noop = () => {};

	const ctx = {
		actions: {
			register: (a: PluginAction) => {
				registered.set(a.id, a);
				return () => registered.delete(a.id);
			},
		},
		events: { on: () => noop, emit: noop, off: noop },
		shapes: {
			register: noop,
			get: () => ({
				getBounds: (s: ShapeData) => ({ x: s.x, y: s.y, width: s.width, height: s.height }),
			}),
		},
		layers: { register: noop, unregister: noop },
		store: {
			getShape: (id: string) => shapes.get(id),
			getShapes: () => shapes,
			getSelection: () => selection,
			addShape: (s: ShapeData) => shapes.set(s.id, s),
			deleteShape: (id: string) => shapes.delete(id),
			subscribe: () => noop,
		},
		commands: {
			execute: (c: { execute(): void; undo(): void }) => {
				c.execute();
				undoStack.push(c);
			},
		},
	} as unknown as PluginContext;

	createPortalPlugin({ doc: new Y.Doc(), userId: "u1" }).setup(ctx);

	const run = (id: string) => registered.get(id)?.run({});
	const undo = () => undoStack.pop()?.undo();
	const select = (id: string) => {
		selection.clear();
		selection.add(id);
	};
	return { shapes, run, undo, select };
}

describe("portal stash / restore flow", () => {
	it("stash removes the shape from the canvas (held in the portal)", () => {
		const { shapes, run, select } = harness();
		shapes.set("s1", rect("s1"));
		select("s1");

		run("portal:stash-selected");
		expect(shapes.has("s1")).toBe(false); // taken off the board
	});

	it("undo of stash restores the shape to the canvas", () => {
		const { shapes, run, undo, select } = harness();
		shapes.set("s1", rect("s1"));
		select("s1");

		run("portal:stash-selected");
		expect(shapes.has("s1")).toBe(false);

		undo();
		expect(shapes.get("s1")).toMatchObject({ id: "s1", x: 10, y: 20 }); // back, same data
	});

	it("clear-mine restores held shapes to the canvas (does not discard them)", () => {
		const { shapes, run, select } = harness();
		shapes.set("s1", rect("s1"));
		select("s1");
		run("portal:stash-selected");
		expect(shapes.has("s1")).toBe(false);

		// Clearing "my portals" must NOT lose the held shape — it returns to the board.
		run("portal:clear-mine");
		expect(shapes.has("s1")).toBe(true);
	});
});
