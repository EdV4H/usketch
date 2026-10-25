import type { ShapeData } from "@edv4h/usketch-shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { moveConnector } from "../move.js";
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

	it("tracks the connected end of a half-connected connector and keeps the free end fixed", () => {
		// a: (0,0)-(100,60). Free target to the right at (400, 30).
		const a = makeRect("a", 0, 0);
		const conn: ConnectableShapeData = {
			...makeConnector("c1", "a", "unused"),
			targetId: undefined,
			sourcePoint: { x: 100, y: 30 },
			targetPoint: { x: 400, y: 30 },
		};
		store.__addShape(a);
		store.__addShape(conn);

		const stop = createConnectorTracker({
			store,
			isConnectorType: (t) => t === "connector",
		});

		// Move a right by 100. The auto source anchor faces the free target point.
		store.__updateRaw("a", { x: 100 });

		const patch = store
			.__getRecordedUpdates()
			.filter((u) => u.id === "c1")
			.at(-1)?.patch as Partial<ConnectableShapeData> | undefined;
		expect(patch).toBeDefined();
		expect(patch?.targetPoint).toEqual({ x: 400, y: 30 });
		expect(patch?.sourcePoint).toEqual({ x: 200, y: 30 });
		expect(patch?.x).toBe(200);
		expect(patch?.y).toBe(30);
		expect(patch?.width).toBe(200);
		expect(patch?.height).toBe(0);

		stop();
	});

	it("tracks a connector whose only connection is the target", () => {
		const b = makeRect("b", 300, 0);
		const conn: ConnectableShapeData = {
			...makeConnector("c1", "unused", "b"),
			sourceId: undefined,
			sourcePoint: { x: 0, y: 30 },
			targetPoint: { x: 300, y: 30 },
		};
		store.__addShape(b);
		store.__addShape(conn);

		const stop = createConnectorTracker({
			store,
			isConnectorType: (t) => t === "connector",
		});

		store.__updateRaw("b", { x: 500 });

		const patch = store
			.__getRecordedUpdates()
			.filter((u) => u.id === "c1")
			.at(-1)?.patch as Partial<ConnectableShapeData> | undefined;
		expect(patch?.sourcePoint).toEqual({ x: 0, y: 30 });
		expect(patch?.targetPoint).toEqual({ x: 500, y: 30 });

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
	// Issue #2: フレーム内の矢印を（フレームごと・範囲選択ごと）移動すると、custom アンカーの
	// 端点が稀に変な方向を向く。ドラッグがコネクタ自身を先に平行移動（moveConnector）した後、
	// 接続先 shape の移動を受けた tracker が同じ移動量をもう一度足していた（処理順依存）。
	describe("custom anchor with ratio (issue #2)", () => {
		function setupCustom() {
			const a = makeRect("a", 0, 0); // 100x60
			const b = makeRect("b", 300, 100);
			const conn: ConnectableShapeData = {
				...makeConnector("c1", "a", "b"),
				sourceAnchor: "custom",
				targetAnchor: "custom",
				// a の右辺の上から 1/3、b の左辺の下から 1/3
				sourcePoint: { x: 100, y: 20 },
				targetPoint: { x: 300, y: 140 },
				sourceAnchorRatio: { x: 1, y: 1 / 3 },
				targetAnchorRatio: { x: 0, y: 2 / 3 },
			};
			store.__addShape(a);
			store.__addShape(b);
			store.__addShape(conn);
			const stop = createConnectorTracker({ store, isConnectorType: (t) => t === "connector" });
			return { conn, stop };
		}

		function endpoints() {
			const c = store.getShape("c1") as ConnectableShapeData;
			return [c.sourcePoint, c.targetPoint];
		}

		it("does not double-shift when the connector is translated before its shapes", () => {
			const { conn, stop } = setupCustom();
			const [dx, dy] = [40, 30];
			// ドラッグセッションの順序: コネクタ（root）→ 子の a → b
			store.__updateRaw("c1", moveConnector(conn, dx, dy));
			store.__updateRaw("a", { x: dx, y: dy });
			store.__updateRaw("b", { x: 300 + dx, y: 100 + dy });

			expect(endpoints()).toEqual([
				{ x: 100 + dx, y: 20 + dy },
				{ x: 300 + dx, y: 140 + dy },
			]);
			stop();
		});

		it("gives the same result regardless of update order", () => {
			const { conn, stop } = setupCustom();
			const [dx, dy] = [40, 30];
			store.__updateRaw("a", { x: dx, y: dy });
			store.__updateRaw("c1", moveConnector(conn, dx, dy));
			store.__updateRaw("b", { x: 300 + dx, y: 100 + dy });

			expect(endpoints()).toEqual([
				{ x: 100 + dx, y: 20 + dy },
				{ x: 300 + dx, y: 140 + dy },
			]);
			stop();
		});

		it("keeps the anchor at the same relative position when the shape is resized", () => {
			const { stop } = setupCustom();
			store.__updateRaw("a", { width: 200, height: 90 });

			expect(endpoints()[0]).toEqual({ x: 200, y: 30 });
			stop();
		});

		// 比率を持たない旧データは、初期化時の位置から比率を補完して同じ計算に乗せる。
		function setupLegacy(order: "shapes-first" | "connector-first" = "shapes-first") {
			const a = makeRect("a", 0, 0);
			const b = makeRect("b", 300, 100);
			const conn: ConnectableShapeData = {
				...makeConnector("c1", "a", "b"),
				sourceAnchor: "custom",
				targetAnchor: "custom",
				sourcePoint: { x: 100, y: 20 },
				targetPoint: { x: 300, y: 140 },
			};
			if (order === "shapes-first") {
				store.__addShape(a);
				store.__addShape(b);
				store.__addShape(conn);
			}
			const stop = createConnectorTracker({ store, isConnectorType: (t) => t === "connector" });
			if (order === "connector-first") {
				store.__addShape(conn);
				store.__addShape(a);
				store.__addShape(b);
			}
			return { conn, stop };
		}

		it("does not double-shift legacy connectors without a ratio", () => {
			const { conn, stop } = setupLegacy();
			const [dx, dy] = [40, 30];
			store.__updateRaw("c1", moveConnector(conn, dx, dy));
			store.__updateRaw("a", { x: dx, y: dy });
			store.__updateRaw("b", { x: 300 + dx, y: 100 + dy });

			expect(endpoints()).toEqual([
				{ x: 100 + dx, y: 20 + dy },
				{ x: 300 + dx, y: 140 + dy },
			]);
			stop();
		});

		it("writes the backfilled ratio on the first tracked move", () => {
			const { stop } = setupLegacy();
			store.__updateRaw("a", { x: 10, y: 0 });

			const c = store.getShape("c1") as ConnectableShapeData;
			expect(c.sourceAnchorRatio).toEqual({ x: 1, y: 1 / 3 });
			expect(c.targetAnchorRatio).toEqual({ x: 0, y: 2 / 3 });
			stop();
		});

		it("backfills when the connected shapes arrive after the connector", () => {
			const { conn, stop } = setupLegacy("connector-first");
			const [dx, dy] = [40, 30];
			store.__updateRaw("c1", moveConnector(conn, dx, dy));
			store.__updateRaw("a", { x: dx, y: dy });
			store.__updateRaw("b", { x: 300 + dx, y: 100 + dy });

			expect(endpoints()).toEqual([
				{ x: 100 + dx, y: 20 + dy },
				{ x: 300 + dx, y: 140 + dy },
			]);
			stop();
		});
	});
});
