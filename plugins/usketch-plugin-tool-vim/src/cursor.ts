import type { Point } from "@edv4h/usketch-shared";
import { getShapeBounds } from "@edv4h/usketch-tool-helpers";
import type { Direction, VimDeps } from "./machine/types.js";

/** カーソル座標をグリッドにスナップする。 */
export function snapToGrid(p: Point, gridSize: number): Point {
	return {
		x: Math.round(p.x / gridSize) * gridSize,
		y: Math.round(p.y / gridSize) * gridSize,
	};
}

/** 方向ベクトル（screen と同じく y は下が正）。 */
const DELTA: Record<Direction, Point> = {
	left: { x: -1, y: 0 },
	right: { x: 1, y: 0 },
	up: { x: 0, y: -1 },
	down: { x: 0, y: 1 },
};

/** カーソルを `dir` 方向へ `distance` だけ動かした座標を返す。 */
export function moveCursorBy(cursor: Point, dir: Direction, distance: number): Point {
	const d = DELTA[dir];
	return { x: cursor.x + d.x * distance, y: cursor.y + d.y * distance };
}

/** shape の中心（world 座標）。見つからなければ null。 */
export function shapeCenter(deps: VimDeps, id: string): Point | null {
	const b = getShapeBounds(deps.store, deps.shapes, id);
	if (!b) return null;
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** point に最も近い shape の ID（中心距離）。excludeIds は除外。 */
export function findNearestShape(
	deps: VimDeps,
	point: Point,
	excludeIds: ReadonlySet<string> = new Set(),
): string | null {
	let best: string | null = null;
	let bestDist = Number.POSITIVE_INFINITY;
	for (const [id] of deps.store.getShapes()) {
		if (excludeIds.has(id)) continue;
		const c = shapeCenter(deps, id);
		if (!c) continue;
		const dist = Math.hypot(c.x - point.x, c.y - point.y);
		if (dist < bestDist) {
			bestDist = dist;
			best = id;
		}
	}
	return best;
}

/**
 * `from` から見て `dir` 方向の cone（±45°）に中心がある shape のうち、
 * 最も近いものの ID を返す（spatial navigation）。excludeIds は除外。
 */
export function findDirectionalNearest(
	deps: VimDeps,
	from: Point,
	dir: Direction,
	excludeIds: ReadonlySet<string> = new Set(),
): string | null {
	let best: string | null = null;
	let bestDist = Number.POSITIVE_INFINITY;
	for (const [id] of deps.store.getShapes()) {
		if (excludeIds.has(id)) continue;
		const c = shapeCenter(deps, id);
		if (!c) continue;
		const dx = c.x - from.x;
		const dy = c.y - from.y;
		// cone 判定: 進行軸の成分が直交軸の成分以上、かつ進行方向に正。
		const inCone =
			(dir === "left" && dx < 0 && Math.abs(dx) >= Math.abs(dy)) ||
			(dir === "right" && dx > 0 && Math.abs(dx) >= Math.abs(dy)) ||
			(dir === "up" && dy < 0 && Math.abs(dy) >= Math.abs(dx)) ||
			(dir === "down" && dy > 0 && Math.abs(dy) >= Math.abs(dx));
		if (!inCone) continue;
		const dist = Math.hypot(dx, dy);
		if (dist < bestDist) {
			bestDist = dist;
			best = id;
		}
	}
	return best;
}

/** 全 shape を内包する world bbox の中心。shape が無ければ null。 */
export function allShapesCenter(deps: VimDeps): Point | null {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	let found = false;
	for (const [id] of deps.store.getShapes()) {
		const b = getShapeBounds(deps.store, deps.shapes, id);
		if (!b) continue;
		found = true;
		minX = Math.min(minX, b.x);
		minY = Math.min(minY, b.y);
		maxX = Math.max(maxX, b.x + b.width);
		maxY = Math.max(maxY, b.y + b.height);
	}
	if (!found) return null;
	return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}
