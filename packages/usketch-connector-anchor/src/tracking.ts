import type { Point, ShapeData } from "@edv4h/usketch-shared";
import {
	clampToShapeEdge,
	getAnchorPoint,
	getAnchorRatio,
	getPointFromAnchorRatio,
} from "./anchor-utils.js";
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
	// Per-connector last known endpoints. Lets us diff sourceId / targetId on
	// `shape:updated` (endpoint reconnection) and adjust the index incrementally
	// without rebuilding from scratch every time.
	const connectorRefs = new Map<string, { sourceId?: string; targetId?: string }>();

	function addRef(shapeId: string, connectorId: string) {
		let bucket = connectorIndex.get(shapeId);
		if (!bucket) {
			bucket = new Set();
			connectorIndex.set(shapeId, bucket);
		}
		bucket.add(connectorId);
	}

	function removeRef(shapeId: string, connectorId: string) {
		const bucket = connectorIndex.get(shapeId);
		if (!bucket) return;
		bucket.delete(connectorId);
		if (bucket.size === 0) connectorIndex.delete(shapeId);
	}

	function syncConnectorRefs(connectorId: string, next: { sourceId?: string; targetId?: string }) {
		const prev = connectorRefs.get(connectorId);
		if (prev?.sourceId && prev.sourceId !== next.sourceId) {
			removeRef(prev.sourceId, connectorId);
		}
		if (prev?.targetId && prev.targetId !== next.targetId) {
			removeRef(prev.targetId, connectorId);
		}
		if (next.sourceId && next.sourceId !== prev?.sourceId) {
			addRef(next.sourceId, connectorId);
		}
		if (next.targetId && next.targetId !== prev?.targetId) {
			addRef(next.targetId, connectorId);
		}
		connectorRefs.set(connectorId, next);
	}

	function dropConnectorRefs(connectorId: string) {
		const prev = connectorRefs.get(connectorId);
		if (!prev) return;
		if (prev.sourceId) removeRef(prev.sourceId, connectorId);
		if (prev.targetId) removeRef(prev.targetId, connectorId);
		connectorRefs.delete(connectorId);
	}

	function rebuildIndex() {
		connectorIndex.clear();
		connectorRefs.clear();
		for (const [id, shape] of store.getShapes()) {
			if (!isConnectorType(shape.type)) continue;
			const connectorData = shape as ConnectableShapeData;
			syncConnectorRefs(id, {
				sourceId: connectorData.sourceId,
				targetId: connectorData.targetId,
			});
		}
	}

	const unsubIndex = store.onMutation((event) => {
		const payload = event.payload as { id?: string } | undefined;
		if (event.type === "shape:added") {
			if (!payload?.id) return;
			const shape = store.getShape(payload.id);
			if (!shape || !isConnectorType(shape.type)) return;
			const connectorData = shape as ConnectableShapeData;
			syncConnectorRefs(payload.id, {
				sourceId: connectorData.sourceId,
				targetId: connectorData.targetId,
			});
			return;
		}
		if (event.type === "shape:removed") {
			if (!payload?.id) return;
			// We may not have the shape anymore; just drop by id (no-op if absent).
			dropConnectorRefs(payload.id);
			return;
		}
		if (event.type === "shape:updated") {
			if (!payload?.id) return;
			const shape = store.getShape(payload.id);
			if (!shape || !isConnectorType(shape.type)) return;
			const connectorData = shape as ConnectableShapeData;
			syncConnectorRefs(payload.id, {
				sourceId: connectorData.sourceId,
				targetId: connectorData.targetId,
			});
		}
	});
	rebuildIndex();

	// Cache previous positions to compute deltas for custom anchors.
	const prevPositions = new Map<string, { x: number; y: number }>();
	function cachePosition(id: string) {
		const shape = store.getShape(id);
		if (shape) prevPositions.set(id, { x: shape.x, y: shape.y });
	}

	// 比率を持たない旧データの custom 端点は、端点と接続先 shape が揃っている時点
	// （初期化時・追加時）の位置から比率を補完しておく。移動時はこの比率で計算し、
	// 同じ更新で shape に書き込む（遅延マイグレーション）。
	type LegacyRatio = { shapeId: string; ratio: Point };
	const legacyRatios = new Map<string, { source?: LegacyRatio; target?: LegacyRatio }>();
	function captureLegacyRatio(
		conn: ConnectableShapeData,
		endpoint: "source" | "target",
	): LegacyRatio | undefined {
		const anchor = endpoint === "source" ? conn.sourceAnchor : conn.targetAnchor;
		const ratio = endpoint === "source" ? conn.sourceAnchorRatio : conn.targetAnchorRatio;
		const shapeId = endpoint === "source" ? conn.sourceId : conn.targetId;
		const point = endpoint === "source" ? conn.sourcePoint : conn.targetPoint;
		if (anchor !== "custom" || ratio || !shapeId || !point) return undefined;
		const shape = store.getShape(shapeId);
		if (!shape) return undefined;
		return { shapeId, ratio: getAnchorRatio(shape, point) };
	}
	function captureLegacyRatios(connId: string) {
		const conn = store.getShape(connId) as ConnectableShapeData | undefined;
		if (!conn || !isConnectorType(conn.type)) return;
		const prev = legacyRatios.get(connId);
		const source = prev?.source ?? captureLegacyRatio(conn, "source");
		const target = prev?.target ?? captureLegacyRatio(conn, "target");
		if (source || target) legacyRatios.set(connId, { source, target });
	}
	function legacyRatio(connId: string, endpoint: "source" | "target", shapeId: string | undefined) {
		const entry = legacyRatios.get(connId)?.[endpoint];
		return entry && entry.shapeId === shapeId ? entry.ratio : undefined;
	}

	for (const [id, shape] of store.getShapes()) {
		if (isConnectorType(shape.type)) {
			captureLegacyRatios(id);
		} else {
			prevPositions.set(id, { x: shape.x, y: shape.y });
		}
	}
	const unsubCacheAdd = store.onMutation((event) => {
		const payload = event.payload as { id?: string } | undefined;
		if (!payload?.id) return;
		if (event.type === "shape:added") {
			cachePosition(payload.id);
			captureLegacyRatios(payload.id);
			// 接続先が後から届いた（同期の到着順）場合も補完する。
			for (const connId of connectorIndex.get(payload.id) ?? []) captureLegacyRatios(connId);
		} else if (event.type === "shape:removed") {
			legacyRatios.delete(payload.id);
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
			// An end without a shape is a free endpoint: it stays at its stored point.
			const source = sourceId ? store.getShape(sourceId) : undefined;
			const target = targetId ? store.getShape(targetId) : undefined;
			if (!source && !target) continue;
			if ((!source && !conn.sourcePoint) || (!target && !conn.targetPoint)) continue;

			const sourceAnchor = conn.sourceAnchor ?? "auto";
			const targetAnchor = conn.targetAnchor ?? "auto";

			// "auto" faces the other end: its shape center, or its fixed point when free.
			const targetCenter = target
				? { x: target.x + target.width / 2, y: target.y + target.height / 2 }
				: (conn.targetPoint as Point);
			const sourceCenter = source
				? { x: source.x + source.width / 2, y: source.y + source.height / 2 }
				: (conn.sourcePoint as Point);

			// custom アンカーは比率（shape からの相対位置）があればそこから毎回計算する。
			// 現在の sourcePoint に移動量を足す方式だと、同じ移動でコネクタ自身も平行移動
			// された場合（フレームごとのドラッグ等）に二重に動き、処理順で結果が変わる。
			const sourceRatio = conn.sourceAnchorRatio ?? legacyRatio(connId, "source", sourceId);
			const targetRatio = conn.targetAnchorRatio ?? legacyRatio(connId, "target", targetId);

			let sourcePoint: Point;
			if (!source) {
				sourcePoint = conn.sourcePoint as Point;
			} else if (sourceAnchor === "custom" && sourceRatio) {
				sourcePoint = getPointFromAnchorRatio(source, sourceRatio);
			} else if (sourceAnchor === "custom" && sourceId === payload.id) {
				const old = conn.sourcePoint as Point;
				sourcePoint = clampToShapeEdge(source, { x: old.x + dx, y: old.y + dy });
			} else if (sourceAnchor === "custom") {
				sourcePoint = conn.sourcePoint as Point;
			} else {
				sourcePoint = getAnchorPoint(source, sourceAnchor, targetCenter);
			}

			let targetPoint: Point;
			if (!target) {
				targetPoint = conn.targetPoint as Point;
			} else if (targetAnchor === "custom" && targetRatio) {
				targetPoint = getPointFromAnchorRatio(target, targetRatio);
			} else if (targetAnchor === "custom" && targetId === payload.id) {
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

			// 補完した比率を書き込んで旧データを移行する。
			if (source && sourceAnchor === "custom" && !conn.sourceAnchorRatio && sourceRatio) {
				updates.sourceAnchorRatio = sourceRatio;
			}
			if (target && targetAnchor === "custom" && !conn.targetAnchorRatio && targetRatio) {
				updates.targetAnchorRatio = targetRatio;
			}
			legacyRatios.delete(connId);

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
