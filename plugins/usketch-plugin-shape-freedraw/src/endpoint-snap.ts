// 線の端を、同じペンの近くの線へつなぐ（`endpointSnap`）。
import type { FreedrawShapeData, StrokeJoins, StrokePoint } from "./types.js";

interface Nearest {
	x: number;
	y: number;
	dist: number;
}

/** 点 q から折れ線 pts へのいちばん近い点。 */
export function nearestOnPolyline(
	q: { x: number; y: number },
	pts: readonly StrokePoint[],
): Nearest | null {
	if (pts.length === 0) return null;
	let best: Nearest = {
		x: pts[0].x,
		y: pts[0].y,
		dist: Math.hypot(q.x - pts[0].x, q.y - pts[0].y),
	};
	for (let i = 1; i < pts.length; i++) {
		const a = pts[i - 1];
		const b = pts[i];
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const len2 = dx * dx + dy * dy;
		const t =
			len2 === 0 ? 0 : Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / len2));
		const x = a.x + dx * t;
		const y = a.y + dy * t;
		const dist = Math.hypot(q.x - x, q.y - y);
		if (dist < best.dist) best = { x, y, dist };
	}
	return best;
}

function nearestAmong(
	q: StrokePoint,
	targets: readonly FreedrawShapeData[],
	maxDist: number,
): Nearest | null {
	let best: Nearest | null = null;
	for (const t of targets) {
		// 外接矩形で先に弾く（shape.x/y/width/height は太さぶん広げてある）。
		if (
			q.x < t.x - maxDist ||
			q.y < t.y - maxDist ||
			q.x > t.x + t.width + maxDist ||
			q.y > t.y + t.height + maxDist
		) {
			continue;
		}
		const n = nearestOnPolyline(q, t.points ?? []);
		if (n && n.dist <= maxDist && (!best || n.dist < best.dist)) best = n;
	}
	return best;
}

/**
 * 始点・終点が `targets` のどれかから `maxDist` 以内なら、その線のいちばん近い点まで
 * 線を伸ばす（端の点を動かさず、点を 1 つ足す）。つないだ端を `joins` に返す。
 * 2 点未満の線（点）はつながない。
 */
export function snapEndpoints(
	points: readonly StrokePoint[],
	targets: readonly FreedrawShapeData[],
	maxDist: number,
): { points: StrokePoint[]; joins?: StrokeJoins } {
	const out = [...points];
	if (out.length < 2 || targets.length === 0 || !(maxDist > 0)) return { points: out };
	const joins: StrokeJoins = {};
	const first = out[0];
	const last = out[out.length - 1];
	const s = nearestAmong(first, targets, maxDist);
	const e = nearestAmong(last, targets, maxDist);
	const EPS = 1e-6;
	if (s) {
		if (s.dist > EPS) out.unshift({ x: s.x, y: s.y, p: first.p });
		joins.start = true;
	}
	if (e) {
		if (e.dist > EPS) out.push({ x: e.x, y: e.y, p: last.p });
		joins.end = true;
	}
	return joins.start || joins.end ? { points: out, joins } : { points: out };
}
