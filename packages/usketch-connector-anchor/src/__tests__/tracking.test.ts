import type { ShapeData } from "@edv4h/usketch-shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type ConnectorTrackingStore, createConnectorTracker } from "../tracking.js";
import type { ConnectableShapeData } from "../types.js";

/**
 * Minimal in-memory store that satisfies `ConnectorTrackingStore` and forwards
 * mutations to subscribed listeners. Keeping the test mock focused (no zIndex,
 * no commands, etc.) makes it easy to assert exactly which `updateShape` calls
 * the tracker emits.
 */
function createMockStore(): ConnectorTrackingStore & {
	__addShape: (s: ShapeData) => void;
	__removeShape: (id: string) => void;
	__updateRaw: (id: string, patch: Partial<ShapeData>) => void;
	__getRecordedUpdates: () => Array<{ id: string; patch: Partial<ShapeData> }>;
} {
	const shapes = new Map<string, ShapeData>();
	const listeners = new Set<(event: { type: string; payload?: { id?: string } }) => void>();
	const updates: Array<{ id: string; patch: Partial<ShapeData> }> = [];

	function emit(event: { type: string; payload?: { id?: string } }) {
		for (const l of listeners) l(event);
	}

	return {
		getShapes: () => shapes,
		getShape: (id) => shapes.get(id),
		updateShape(id, patch) {
			const existing = shapes.get(id);
			if (!existing) return;
			const next = { ...existing, ...patch } as ShapeData;
			shapes.set(id, next);
			updates.push({ id, patch });
			emit({ type: "shape:updated", payload: { id } });
		},
		onMutation(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		__addShape(shape) {
			shapes.set(shape.id, shape);
			emit({ type: "shape:added", payload: { id: shape.id } });
		},
		__removeShape(id) {
			shapes.delete(id);
			emit({ type: "shape:removed", payload: { id } });
		},
		__updateRaw(id, patch) {
			const existing = shapes.get(id);
			if (!existing) return;
			shapes.set(id, { ...existing, ...patch } as ShapeData);
			emit({ type: "shape:updated", payload: { id } });
		},
		__getRecordedUpdates: () => updates,
	};
}

function makeRect(id: string, x: number, y: number): ShapeData {
	return {
		id,
		type: "rect",
		x,
		y,
		width: 100,
		height: 60,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
	} as ShapeData;
}

function makeConnector(id: string, sourceId: string, targetId: string): ConnectableShapeData {
	return {
		id,
		type: "connector",
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		style: { fill: "transparent", stroke: "#000", strokeWidth: 1, opacity: 1 },
		sourceId,
		targetId,
		sourceAnchor: "auto",
		targetAnchor: "auto",
		sourcePoint: { x: 0, y: 0 },
		targetPoint: { x: 0, y: 0 },
		controlPointAuto: true,
		arrowHead: "forward",
		pathType: "straight",
	};
}

describe("createConnectorTracker", () => {
	let store: ReturnType<typeof createMockStore>;

	beforeEach(() => {
		store = createMockStore();
	});

	it("recomputes connector endpoints when a referenced shape moves", () => {
		const a = makeRect("a", 0, 0);
		const b = makeRect("b", 300, 0);
		const conn = makeConnector("c1", "a", "b");
		store.__addShape(a);
		store.__addShape(b);
		store.__addShape(conn);

		const stop = createConnectorTracker({
			store,
			isConnectorType: (t) => t === "connector",
		});

		// Move shape b to the right.
		store.__updateRaw("b", { x: 500 });

		const connUpdates = store
			.__getRecordedUpdates()
			.filter((u) => u.id === "c1")
			.at(-1);
		expect(connUpdates).toBeDefined();
		// targetPoint should track the moved shape: with `auto` anchor and shape a
		// to the left, the target anchor lands on b's left edge → x = 500.
		const patch = connUpdates?.patch as Partial<ConnectableShapeData>;
		expect(patch.targetPoint?.x).toBe(500);

		stop();
	});

	it("does NOT update connectors that don't reference the moved shape", () => {
		const a = makeRect("a", 0, 0);
		const b = makeRect("b", 300, 0);
		const c = makeRect("c", 600, 0);
		const conn = makeConnector("c1", "a", "b");
		store.__addShape(a);
		store.__addShape(b);
		store.__addShape(c);
		store.__addShape(conn);

		const stop = createConnectorTracker({
			store,
			isConnectorType: (t) => t === "connector",
		});

		store.__updateRaw("c", { x: 700 });

		const connUpdates = store.__getRecordedUpdates().filter((u) => u.id === "c1");
		expect(connUpdates).toHaveLength(0);

		stop();
	});

	it("follows endpoint reconnection (sourceId/targetId changing on shape:updated)", () => {
		const a = makeRect("a", 0, 0);
		const b = makeRect("b", 300, 0);
		const c = makeRect("c", 600, 0);
		const conn = makeConnector("c1", "a", "b");
		store.__addShape(a);
		store.__addShape(b);
		store.__addShape(c);
		store.__addShape(conn);

		const stop = createConnectorTracker({
			store,
			isConnectorType: (t) => t === "connector",
		});

		// Reconnect c1's target from b to c via a `shape:updated`.
		store.__updateRaw("c1", { targetId: "c" } as Partial<ShapeData>);
		// Clear the noise from the reconnection update itself.
		const updatesBeforeMove = store.__getRecordedUpdates().length;

		// Now move c. The tracker should see c1 as referencing c and update its
		// target endpoint, even though the index was first built from {a, b}.
		store.__updateRaw("c", { x: 800 });

		const updates = store.__getRecordedUpdates().slice(updatesBeforeMove);
		const connectorUpdate = updates.find((u) => u.id === "c1");
		expect(connectorUpdate).toBeDefined();
		const patch = connectorUpdate?.patch as Partial<ConnectableShapeData>;
		expect(patch.targetPoint?.x).toBe(800);

		// Conversely, moving the OLD target b should no longer update c1.
		const beforeOldTargetMove = store.__getRecordedUpdates().length;
		store.__updateRaw("b", { x: 1000 });
		const oldTargetUpdates = store
			.__getRecordedUpdates()
			.slice(beforeOldTargetMove)
			.filter((u) => u.id === "c1");
		expect(oldTargetUpdates).toHaveLength(0);

		stop();
	});

	it("drops connector references when the connector is removed", () => {
		const a = makeRect("a", 0, 0);
		const b = makeRect("b", 300, 0);
		const conn = makeConnector("c1", "a", "b");
		store.__addShape(a);
		store.__addShape(b);
		store.__addShape(conn);

		const stop = createConnectorTracker({
			store,
			isConnectorType: (t) => t === "connector",
		});

		store.__removeShape("c1");
		const beforeMove = store.__getRecordedUpdates().length;
		store.__updateRaw("a", { x: 50 });
		const afterMove = store.__getRecordedUpdates().slice(beforeMove);

		// No update should target the deleted connector.
		expect(afterMove.find((u) => u.id === "c1")).toBeUndefined();

		stop();
	});

	it("teardown removes all listeners", () => {
		const stop = createConnectorTracker({
			store,
			isConnectorType: (t) => t === "connector",
		});

		const updateSpy = vi.spyOn(store, "updateShape");
		stop();

		const a = makeRect("a", 0, 0);
		const b = makeRect("b", 300, 0);
		store.__addShape(a);
		store.__addShape(b);
		store.__addShape(makeConnector("c1", "a", "b"));
		store.__updateRaw("a", { x: 50 });

		expect(updateSpy).not.toHaveBeenCalled();
	});
});
