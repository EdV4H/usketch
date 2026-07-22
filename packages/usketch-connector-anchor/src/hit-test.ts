import type { BoundingBox, Point, ShapeData } from "@edv4h/usketch-shared";
import {
	bezierBounds,
	distanceToLineSegment,
	distanceToPolyline,
	getDefaultControlPoint,
	getElbowPoints,
	isNearBezier,
} from "./path-utils.js";
import type { ConnectableShapeData } from "./types.js";

/**
 * Minimal context shape used by `findShapeAtPoint`. Both `ToolContext` and
 * `PluginContext` from `@edv4h/usketch-shared` satisfy this. `getShapesSorted`
 * is preferred when available (returns shapes in zIndex order); we fall back to
 * `getShapes()` (insertion order) for stores that don't expose the sorted view.
 */
export interface FindShapeAtPointContext {
	store: {
		getShapes(): ReadonlyMap<string, ShapeData>;
		getShapesSorted?(): readonly ShapeData[];
	};
	shapes: {
		get(type: string): { hitTest: (data: ShapeData, point: Point) => boolean } | undefined;
	};
}

/**
 * Find the topmost shape at a point. Iterates in reverse zIndex order so the
 * visually-topmost shape wins. Skips any shape type listed in `excludeTypes`
 * (typically the caller's own connector type to avoid hit testing connectors
 * as drag targets), and prefers concrete shapes over containers
 * (`frame` / `group`) when both overlap.
 */
export function findShapeAtPoint(
	ctx: FindShapeAtPointContext,
	point: Point,
	options?: { excludeTypes?: ReadonlySet<string> },
): ShapeData | null {
	const exclude = options?.excludeTypes;
	const shapeMap = ctx.store.getShapes();
	const ordered: ShapeData[] = ctx.store.getShapesSorted
		? [...ctx.store.getShapesSorted()].reverse()
		: [...shapeMap.values()].reverse();
	// A hidden/locked shape (or one under a hidden/locked ancestor) is not a valid
	// anchor target — mirrors the engine-wide interaction rule. Memoized per shape
	// id (siblings reuse a parent's result) since this runs in a hot pointer path;
	// the cache is pre-seeded before recursing so a parentId cycle terminates.
	const blockedCache = new Map<string, boolean>();
	const isBlocked = (data: ShapeData): boolean => {
		const cached = blockedCache.get(data.id);
		if (cached !== undefined) return cached;
		blockedCache.set(data.id, false); // cycle guard
		let result = data.hidden === true || data.locked === true;
		if (!result && typeof data.parentId === "string") {
			const parent = shapeMap.get(data.parentId);
			if (parent) result = isBlocked(parent);
		}
		blockedCache.set(data.id, result);
		return result;
	};
	let fallbackContainer: ShapeData | null = null;
	for (const data of ordered) {
		if (exclude?.has(data.type)) continue;
		if (isBlocked(data)) continue;
		const def = ctx.shapes.get(data.type);
		if (!def?.hitTest(data, point)) continue;
		if (data.type === "frame" || data.type === "group") {
			if (!fallbackContainer) fallbackContainer = data;
			continue;
		}
		return data;
	}
	return fallbackContainer;
}

// ── Endpoint helpers ──

export function sourceXY(data: ShapeData): Point {
	const p = (data as ConnectableShapeData).sourcePoint;
	return { x: p?.x ?? data.x, y: p?.y ?? data.y };
}

export function targetXY(data: ShapeData): Point {
	const p = (data as ConnectableShapeData).targetPoint;
	return { x: p?.x ?? data.x + data.width, y: p?.y ?? data.y + data.height };
}

// ── Connector bounds / hit test ──

export function getBoundsConnector(data: ShapeData): BoundingBox {
	const connectorData = data as ConnectableShapeData;
	const src = sourceXY(data);
	const tgt = targetXY(data);
	const pathType = connectorData.pathType ?? "straight";

	if (pathType === "curve") {
		const cp = connectorData.controlPoint ?? getDefaultControlPoint(src, tgt);
		return bezierBounds(src, cp, tgt);
	}

	const minX = Math.min(src.x, tgt.x);
	const minY = Math.min(src.y, tgt.y);
	return {
		x: minX,
		y: minY,
		width: Math.abs(tgt.x - src.x),
		height: Math.abs(tgt.y - src.y),
	};
}

export function hitTestConnector(data: ShapeData, point: Point, tolerance = 6): boolean {
	const connectorData = data as ConnectableShapeData;
	const src = sourceXY(data);
	const tgt = targetXY(data);
	const pathType = connectorData.pathType ?? "straight";

	if (pathType === "curve") {
		const cp = connectorData.controlPoint ?? getDefaultControlPoint(src, tgt);
		return isNearBezier(point, src, cp, tgt, tolerance);
	}

	if (pathType === "elbow") {
		const elbowPts = getElbowPoints(src, tgt);
		return distanceToPolyline(point, elbowPts) <= tolerance;
	}

	// straight
	return distanceToLineSegment(point, src, tgt) <= tolerance;
}
