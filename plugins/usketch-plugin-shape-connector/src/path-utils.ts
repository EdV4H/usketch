import type { BoundingBox, Point } from "@edv4h/usketch-shared";

// ── Line segment distance ──

/** Compute the minimum distance from a point to a line segment (a → b). */
export function distanceToLineSegment(point: Point, a: Point, b: Point): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const lengthSq = dx * dx + dy * dy;

	if (lengthSq === 0) return Math.hypot(point.x - a.x, point.y - a.y);

	let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq;
	t = Math.max(0, Math.min(1, t));

	const nearestX = a.x + t * dx;
	const nearestY = a.y + t * dy;
	return Math.hypot(point.x - nearestX, point.y - nearestY);
}

/** Compute the minimum distance from a point to a polyline (array of vertices). */
export function distanceToPolyline(point: Point, polyline: Point[]): number {
	let minDist = Number.POSITIVE_INFINITY;
	for (let i = 0; i < polyline.length - 1; i++) {
		const dist = distanceToLineSegment(point, polyline[i], polyline[i + 1]);
		if (dist < minDist) minDist = dist;
	}
	return minDist;
}

// ── Elbow path ──

/** Compute the 4 vertices of an elbow (L-shaped) path: source → mid-h → mid-v → target. */
export function getElbowPoints(source: Point, target: Point): Point[] {
	const midX = (source.x + target.x) / 2;
	return [source, { x: midX, y: source.y }, { x: midX, y: target.y }, target];
}

// ── Quadratic Bezier ──

/** Compute a default control point for a quadratic Bezier between source and target. */
export function getDefaultControlPoint(source: Point, target: Point): Point {
	const mx = (source.x + target.x) / 2;
	const my = (source.y + target.y) / 2;
	const dx = target.x - source.x;
	const dy = target.y - source.y;
	const len = Math.hypot(dx, dy);
	if (len === 0) return { x: mx, y: my - 50 };
	// Perpendicular offset = 25% of the distance
	const offset = len * 0.25;
	return { x: mx - (dy / len) * offset, y: my + (dx / len) * offset };
}

/** Sample N+1 points along a quadratic Bezier Q(p0, cp, p2). */
export function sampleQuadraticBezier(p0: Point, cp: Point, p2: Point, n: number): Point[] {
	const points: Point[] = [];
	for (let i = 0; i <= n; i++) {
		const t = i / n;
		const u = 1 - t;
		points.push({
			x: u * u * p0.x + 2 * u * t * cp.x + t * t * p2.x,
			y: u * u * p0.y + 2 * u * t * cp.y + t * t * p2.y,
		});
	}
	return points;
}

/** Check if a point is within tolerance of a quadratic Bezier curve. */
export function isNearBezier(
	point: Point,
	p0: Point,
	cp: Point,
	p2: Point,
	tolerance: number,
): boolean {
	const samples = sampleQuadraticBezier(p0, cp, p2, 20);
	return distanceToPolyline(point, samples) <= tolerance;
}

/** Compute the bounding box that contains the quadratic Bezier (including control point). */
export function bezierBounds(p0: Point, cp: Point, p2: Point): BoundingBox {
	const minX = Math.min(p0.x, cp.x, p2.x);
	const minY = Math.min(p0.y, cp.y, p2.y);
	const maxX = Math.max(p0.x, cp.x, p2.x);
	const maxY = Math.max(p0.y, cp.y, p2.y);
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// ── Path midpoint ──

export type PathType = "straight" | "elbow" | "curve";

/** Compute the midpoint of a connector path. */
export function getPathMidpoint(
	pathType: PathType,
	source: Point,
	target: Point,
	controlPoint?: Point,
): Point {
	switch (pathType) {
		case "straight":
			return { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
		case "elbow": {
			const midX = (source.x + target.x) / 2;
			const midY = (source.y + target.y) / 2;
			return { x: midX, y: midY };
		}
		case "curve": {
			const cp = controlPoint ?? getDefaultControlPoint(source, target);
			// Q(0.5) = 0.25*p0 + 0.5*cp + 0.25*p2
			return {
				x: 0.25 * source.x + 0.5 * cp.x + 0.25 * target.x,
				y: 0.25 * source.y + 0.5 * cp.y + 0.25 * target.y,
			};
		}
	}
}
