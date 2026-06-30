import type { BoundingBox, Point } from "@edv4h/usketch-shared";
import { penMeta } from "../pen-meta.js";
import type { FreedrawShapeData, PenKind, StrokePoint } from "../types.js";

/** 点ごとの実効半幅（world px）。可変ペンは p×size、一定ペンは size 基準。 */
function halfWidthAt(pt: StrokePoint, pen: PenKind | undefined, size: number): number {
	const m = penMeta(pen);
	if (m.variable) {
		const min = Math.max(0.6, size * 0.22);
		const max = size * 1.55;
		const w = min + (max - min) * (pt.p ?? 0.5);
		return w / 2;
	}
	return size / 2;
}

/** ストロークの最大半幅。 */
export function maxHalfWidth(data: FreedrawShapeData): number {
	const size = data.style?.strokeWidth ?? 1;
	const m = penMeta(data.pen);
	return m.variable ? (size * 1.55) / 2 : size / 2;
}

/** 点列 + 最大半幅で bbox を算出（細い線でも掴める）。 */
export function strokeBounds(data: FreedrawShapeData): BoundingBox {
	const points = data.points ?? [];
	if (points.length === 0) {
		return { x: data.x, y: data.y, width: 0, height: 0 };
	}
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const p of points) {
		if (p.x < minX) minX = p.x;
		if (p.y < minY) minY = p.y;
		if (p.x > maxX) maxX = p.x;
		if (p.y > maxY) maxY = p.y;
	}
	const pad = maxHalfWidth(data);
	return {
		x: minX - pad,
		y: minY - pad,
		width: maxX - minX + pad * 2,
		height: maxY - minY + pad * 2,
	};
}

/** 点 p から線分 ab までの距離の2乗。 */
function distToSegment2(p: Point, a: StrokePoint, b: StrokePoint): number {
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
 * 折れ線距離による hitTest。点が線（半幅 + tolerance 内）に乗っていれば true。
 * 1点ストロークは円として判定。
 */
export function hitStroke(data: FreedrawShapeData, point: Point, tolerance = 2): boolean {
	const points = data.points ?? [];
	const size = data.style?.strokeWidth ?? 1;
	if (points.length === 0) return false;
	if (points.length === 1) {
		const r = halfWidthAt(points[0], data.pen, size) + tolerance;
		const dx = point.x - points[0].x;
		const dy = point.y - points[0].y;
		return dx * dx + dy * dy <= r * r;
	}
	for (let i = 1; i < points.length; i++) {
		const a = points[i - 1];
		const b = points[i];
		const half = Math.max(halfWidthAt(a, data.pen, size), halfWidthAt(b, data.pen, size));
		const r = half + tolerance;
		if (distToSegment2(point, a, b) <= r * r) return true;
	}
	return false;
}

/**
 * 消しゴム判定（設計書 §8）。いずれかの点が消しゴム円（r + 半幅）に入れば true。
 * @param r 消しゴム半径 = eraserSize/2 + 1
 */
export function eraserHits(data: FreedrawShapeData, cursor: Point, r: number): boolean {
	const points = data.points ?? [];
	const size = data.style?.strokeWidth ?? 1;
	for (const pt of points) {
		const half = halfWidthAt(pt, data.pen, size);
		const dx = pt.x - cursor.x;
		const dy = pt.y - cursor.y;
		if (Math.hypot(dx, dy) <= r + half) return true;
	}
	return false;
}
