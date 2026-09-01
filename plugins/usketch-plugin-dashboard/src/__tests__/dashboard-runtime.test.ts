import type { EventBus, PluginContext, ShapeData } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import { makeDashboardConfig } from "../dashboard-config-shape.js";
import { setupDashboard } from "../dashboard-runtime.js";

function rect(id: string, x: number, y: number, width = 100, height = 100): ShapeData {
	return {
		id,
		type: "rectangle",
		x,
		y,
		width,
		height,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
	};
}

function makeEvents(): EventBus {
	const listeners = new Map<string, Set<(p: unknown) => void>>();
	return {
		on(type: string, fn: (p: unknown) => void) {
			const bucket = listeners.get(type) ?? new Set();
			bucket.add(fn);
			listeners.set(type, bucket);
			return () => bucket.delete(fn);
		},
		emit(type: string, payload: unknown) {
			for (const fn of listeners.get(type) ?? []) fn(payload);
		},
		pause() {},
		resume() {},
		isPaused: () => false,
	} as unknown as EventBus;
}

function harness() {
	const store = createBoardStore();
	const undo: { execute(): void; undo(): void }[] = [];
	const commands = {
		execute(c: { execute(): void; undo(): void }) {
			c.execute();
			undo.push(c);
		},
		undo() {
			undo.pop()?.undo();
		},
		redo() {},
		canUndo: () => undo.length > 0,
		canRedo: () => false,
		getHistorySize: () => undo.length,
		getCursor: () => 0,
	};
	const events = makeEvents();
	const ctx = { store, commands, events } as unknown as PluginContext;
	return { ctx, store, events };
}

const at = (store: ReturnType<typeof createBoardStore>, id: string) => {
	const s = store.getShape(id);
	return s ? { x: s.x, y: s.y } : null;
};

// Simulate the select tool driving a shape drag: the shape is the sole selection
// and its position is written frame-by-frame, then move-end fires on drop.
function drag(
	store: ReturnType<typeof createBoardStore>,
	events: EventBus,
	id: string,
	frames: { x: number; y: number }[],
): void {
	store.setSelection([id]);
	for (const f of frames) store.updateShape(id, f);
	events.emit("shapes:move-end", { shapeIds: [id] });
}

describe("dashboard runtime — drag to front (swap with leftmost)", () => {
	it("single row: dragging the last item onto the leftmost makes it first", async () => {
		const { ctx, store, events } = harness();
		store.addShape(
			makeDashboardConfig({
				columns: 3,
				cellW: 100,
				cellH: 100,
				gap: 0,
				padding: 0,
				originX: 0,
				originY: 0,
			}),
		);
		store.addShape(rect("a", 0, 0));
		store.addShape(rect("b", 100, 0));
		store.addShape(rect("c", 200, 0));
		const stop = setupDashboard(ctx);
		await Promise.resolve(); // flush seedItemIds microtask

		// Drag c leftward onto a's cell (drop centre in col0's left half).
		drag(store, events, "c", [
			{ x: 140, y: 0 },
			{ x: 60, y: 0 },
			{ x: 10, y: 0 },
		]);

		expect(at(store, "c")).toEqual({ x: 0, y: 0 }); // c is now leftmost
		expect(at(store, "a")).toEqual({ x: 100, y: 0 });
		expect(at(store, "b")).toEqual({ x: 200, y: 0 });
		stop();
	});

	it("two rows: dragging the last item onto the very first cell makes it first", async () => {
		const { ctx, store, events } = harness();
		store.addShape(
			makeDashboardConfig({
				columns: 2,
				cellW: 100,
				cellH: 100,
				gap: 0,
				padding: 0,
				originX: 0,
				originY: 0,
			}),
		);
		store.addShape(rect("a", 0, 0)); // r0c0
		store.addShape(rect("b", 100, 0)); // r0c1
		store.addShape(rect("c", 0, 100)); // r1c0
		store.addShape(rect("d", 100, 100)); // r1c1
		const stop = setupDashboard(ctx);
		await Promise.resolve();

		// Drag d (last) up-left onto a's cell (r0c0).
		drag(store, events, "d", [
			{ x: 60, y: 60 },
			{ x: 20, y: 20 },
			{ x: 5, y: 5 },
		]);

		// d should be first: d,a,b,c → r0c0,r0c1,r1c0,r1c1
		expect(at(store, "d")).toEqual({ x: 0, y: 0 });
		expect(at(store, "a")).toEqual({ x: 100, y: 0 });
		expect(at(store, "b")).toEqual({ x: 0, y: 100 });
		expect(at(store, "c")).toEqual({ x: 100, y: 100 });
		stop();
	});
});
