import type { Point, ShapeData } from "@edv4h/usketch-shared";
import { clampToShapeEdge, getAnchorPoint } from "./anchor-utils.js";
import { getDefaultControlPoint } from "./path-utils.js";
import type { ConnectableShapeData } from "./types.js";

/**
 * Subset of `BoardStore` used by the tracker. We deliberately accept any store
 * shape that exposes the methods we need so callers can pass either the real
 * `BoardStore` or a test mock.
 */
export interface ConnectorTrackingStore {
	getShapes(): ReadonlyMap<string, ShapeData>;
	getShape(id: string): ShapeData | undefined;
	updateShape(id: string, patch: Partial<ShapeData>): void;
	onMutation(
		listener: (event: { type: string; payload?: { id?: string } | unknown }) => void,
	): () => void;
}

export interface ConnectorTrackerOptions {
	store: ConnectorTrackingStore;
	/** Predicate to decide whether a given shape `type` is a connector handled by this tracker. */
	isConnectorType: (type: string) => boolean;
}

/**
 * Wire up a position-tracking subscriber so that whenever a referenced shape
 * moves, every connector pointing to / from it has its endpoints recomputed
 * (auto anchors re-evaluated, custom anchors clamped).
 *
 * Returns a teardown function.
 */
export function createConnectorTracker(opts: ConnectorTrackerOptions): () => void {
	const { store, isConnectorType } = opts;

	// Connector index: shape id → set of connector ids referencing it.
	const connectorIndex = new Map<string, Set<string>>();

	function rebuildIndex() {
		connectorIndex.clear();
		for (const [id, shape] of store.getShapes()) {
			if (!isConnectorType(shape.type)) continue;
			const connectorData = shape as ConnectableShapeData;
			const src = connectorData.sourceId;
			const tgt = connectorData.targetId;
			if (src) {
				if (!connectorIndex.has(src)) connectorIndex.set(src, new Set());
				connectorIndex.get(src)?.add(id);
			}
			if (tgt) {
				if (!connectorIndex.has(tgt)) connectorIndex.set(tgt, new Set());
				connectorIndex.get(tgt)?.add(id);
			}
		}
	}

	const unsubIndex = store.onMutation((event) => {
		if (event.type === "shape:added" || event.type === "shape:removed") {
			rebuildIndex();
		}
	});
	rebuildIndex();

	// Cache previous positions to compute deltas for custom anchors.
	const prevPositions = new Map<string, { x: number; y: number }>();
	function cachePosition(id: string) {
		const shape = store.getShape(id);
		if (shape) prevPositions.set(id, { x: shape.x, y: shape.y });
	}
	for (const [id, shape] of store.getShapes()) {
		if (!isConnectorType(shape.type)) {
			prevPositions.set(id, { x: shape.x, y: shape.y });
		}
	}
	const unsubCacheAdd = store.onMutation((event) => {
		if (event.type === "shape:added") {
			const payload = event.payload as { id?: string } | undefined;
			if (payload?.id) cachePosition(payload.id);
		}
	});

	const unsubMove = store.onMutation((event) => {
		if (event.type !== "shape:updated") return;
		const payload = event.payload as { id?: string } | undefined;
		if (!payload?.id) return;

		const connIds = connectorIndex.get(payload.id);
		if (!connIds || connIds.size === 0) {
			cachePosition(payload.id);
			return;
		}

		const movedShape = store.getShape(payload.id);
		const prev = prevPositions.get(payload.id);
		const dx = movedShape && prev ? movedShape.x - prev.x : 0;
		const dy = movedShape && prev ? movedShape.y - prev.y : 0;

		for (const connId of connIds) {
			const conn = store.getShape(connId) as ConnectableShapeData | undefined;
			if (!conn) continue;
			const sourceId = conn.sourceId;
			const targetId = conn.targetId;
			if (!sourceId || !targetId) continue;

			const source = store.getShape(sourceId);
			const target = store.getShape(targetId);
			if (!source || !target) continue;

			const sourceAnchor = conn.sourceAnchor ?? "auto";
			const targetAnchor = conn.targetAnchor ?? "auto";

			const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
			const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };

			let sourcePoint: Point;
			if (sourceAnchor === "custom" && sourceId === payload.id) {
				const old = conn.sourcePoint as Point;
				sourcePoint = clampToShapeEdge(source, { x: old.x + dx, y: old.y + dy });
			} else if (sourceAnchor === "custom") {
				sourcePoint = conn.sourcePoint as Point;
			} else {
				sourcePoint = getAnchorPoint(source, sourceAnchor, targetCenter);
			}

			let targetPoint: Point;
			if (targetAnchor === "custom" && targetId === payload.id) {
				const old = conn.targetPoint as Point;
				targetPoint = clampToShapeEdge(target, { x: old.x + dx, y: old.y + dy });
			} else if (targetAnchor === "custom") {
				targetPoint = conn.targetPoint as Point;
			} else {
				targetPoint = getAnchorPoint(target, targetAnchor, sourceCenter);
			}

			const updates: Partial<ConnectableShapeData> = {
				sourcePoint,
				targetPoint,
				x: Math.min(sourcePoint.x, targetPoint.x),
				y: Math.min(sourcePoint.y, targetPoint.y),
				width: Math.abs(targetPoint.x - sourcePoint.x),
				height: Math.abs(targetPoint.y - sourcePoint.y),
			};

			if (conn.controlPointAuto && conn.pathType === "curve") {
				updates.controlPoint = getDefaultControlPoint(sourcePoint, targetPoint);
			}

			store.updateShape(connId, updates as Partial<ShapeData>);
		}

		cachePosition(payload.id);
	});

	return () => {
		unsubIndex();
		unsubCacheAdd();
		unsubMove();
	};
}
