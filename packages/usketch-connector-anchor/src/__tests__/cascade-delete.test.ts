import type { ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { type CascadeDeleteStore, createCascadeDelete } from "../cascade-delete.js";

function createMockStore(initial: ShapeData[]) {
	const shapes = new Map(initial.map((s) => [s.id, s]));
	const listeners = new Set<(event: { type: string; payload?: unknown }) => void>();
	const emit = (event: { type: string; payload?: unknown }) => {
		for (const l of listeners) l(event);
	};
	const store: CascadeDeleteStore & { removeShape: (id: string) => void } = {
		getShapes: () => shapes,
		deleteShape(id) {
			shapes.delete(id);
		},
		updateShape(id, patch) {
			const existing = shapes.get(id);
			if (existing) shapes.set(id, { ...existing, ...patch } as ShapeData);
		},
		onMutation(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		removeShape(id) {
			shapes.delete(id);
			emit({ type: "shape:removed", payload: { id } });
		},
	};
	return { store, shapes };
}

function connector(id: string, ends: { sourceId?: string; targetId?: string }): ShapeData {
	return {
		id,
		type: "connector",
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		style: { fill: "transparent", stroke: "#000", strokeWidth: 1, opacity: 1 },
		sourcePoint: { x: 10, y: 20 },
		targetPoint: { x: 300, y: 20 },
		...ends,
	} as ShapeData;
}

describe("createCascadeDelete", () => {
	const isConnectorType = (t: string) => t === "connector";

	it("deletes a connector connected at both ends when one end is removed", () => {
		const { store, shapes } = createMockStore([connector("c1", { sourceId: "a", targetId: "b" })]);
		createCascadeDelete({ store, isConnectorType });

		store.removeShape("a");
		expect(shapes.has("c1")).toBe(false);
	});

	it("detaches a half-connected connector, keeping its endpoints", () => {
		const { store, shapes } = createMockStore([connector("c1", { sourceId: "a" })]);
		createCascadeDelete({ store, isConnectorType });

		store.removeShape("a");
		const c = shapes.get("c1") as ShapeData & Record<string, unknown>;
		expect(c).toBeDefined();
		expect(c.sourceId).toBeUndefined();
		expect(c.sourcePoint).toEqual({ x: 10, y: 20 });
	});
});
