import type { StrokePoint } from "../types.js";

function segDist2(p: StrokePoint, a: StrokePoint, b: StrokePoint): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len2 = dx * dx + dy * dy;
	let t = len2 > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
	t = Math.max(0, Math.min(1, t));
	const cx = a.x + t * dx;
	const cy = a.y + t * dy;
	const ex = p.x - cx;
	const ey = p.y - cy;
	return ex * ex + ey * ey;
}

/**
 * Ramer–Douglas–Peucker 間引き。確定時に点数を削減して store/Yjs サイズを抑える。
 * 端点と各点の `p`（疑似筆圧）は保持。tolerance が 0 以下なら原本を返す。
 */
export function simplifyPoints(points: StrokePoint[], tolerance: number): StrokePoint[] {
	if (tolerance <= 0 || points.length <= 2) return points;
	const tol2 = tolerance * tolerance;
	const keep = new Array<boolean>(points.length).fill(false);
	keep[0] = true;
	keep[points.length - 1] = true;

	const stack: [number, number][] = [[0, points.length - 1]];
	while (stack.length) {
		const [first, last] = stack.pop() as [number, number];
		let maxD = 0;
		let idx = -1;
		for (let i = first + 1; i < last; i++) {
			const d = segDist2(points[i], points[first], points[last]);
			if (d > maxD) {
				maxD = d;
				idx = i;
			}
		}
		if (maxD > tol2 && idx !== -1) {
			keep[idx] = true;
			stack.push([first, idx], [idx, last]);
		}
	}

	const out: StrokePoint[] = [];
	for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
	return out;
}
