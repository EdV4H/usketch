import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { createScatterCommand } from "../command.js";

function makeStore(initial: Partial<ShapeData>[]) {
	const shapes = new Map<string, ShapeData>(initial.map((s) => [s.id as string, s as ShapeData]));
	const store = {
		getShape: (id: string) => shapes.get(id),
		addShape: (s: ShapeData) => shapes.set(s.id, s),
		updateShape: (id: string, patch: Partial<ShapeData>) => {
			const s = shapes.get(id);
			if (s) shapes.set(id, { ...s, ...patch });
		},
		deleteShape: (id: string) => shapes.delete(id),
	} as unknown as BoardStore;
	return { shapes, store };
}

const rect = (id: string, x: number, y: number) =>
	({ id, type: "rect", x, y, width: 10, height: 10, style: {} }) as ShapeData;

describe("createScatterCommand", () => {
	it("execute is idempotent (no duplicate spawn) and moves existing shapes", () => {
		const { shapes, store } = makeStore([rect("e", 0, 0)]);
		const n = rect("n", 100, 100);
		const cmd = createScatterCommand(
			store,
			[n],
			new Map([["e", rect("e", 0, 0)]]),
			new Map([["e", { x: 50, y: 50 }]]),
		);
		cmd.execute();
		cmd.execute(); // running twice must not duplicate the new shape
		expect(shapes.size).toBe(2); // e + n, not e + n + n
		expect(shapes.get("n")?.x).toBe(100);
		expect(shapes.get("e")).toMatchObject({ x: 50, y: 50 });
	});

	it("undo deletes spawned shapes and restores existing 'before'", () => {
		const { shapes, store } = makeStore([rect("e", 0, 0)]);
		const cmd = createScatterCommand(
			store,
			[rect("n", 100, 100)],
			new Map([["e", rect("e", 0, 0)]]),
			new Map([["e", { x: 50, y: 50 }]]),
		);
		cmd.execute();
		cmd.undo();
		expect(shapes.has("n")).toBe(false);
		expect(shapes.get("e")).toMatchObject({ x: 0, y: 0 });
	});
});
