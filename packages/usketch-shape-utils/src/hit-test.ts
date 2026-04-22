import type { Point, ShapeData } from "@edv4h/usketch-shared";

export function aabbHitTest(data: ShapeData, point: Point): boolean {
	return (
		point.x >= data.x &&
		point.x <= data.x + data.width &&
		point.y >= data.y &&
		point.y <= data.y + data.height
	);
}

export function ellipseHitTest(data: ShapeData, point: Point): boolean {
	const rx = data.width / 2;
	const ry = data.height / 2;
	if (rx === 0 || ry === 0) return false;
	const cx = data.x + rx;
	const cy = data.y + ry;
	const dx = (point.x - cx) / rx;
	const dy = (point.y - cy) / ry;
	return dx * dx + dy * dy <= 1;
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const xi = polygon[i].x;
		const yi = polygon[i].y;
		const xj = polygon[j].x;
		const yj = polygon[j].y;
		const intersect =
			yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
		if (intersect) inside = !inside;
	}
	return inside;
}

export function lineHitTest(data: ShapeData, point: Point, tolerance = 4): boolean {
	const x1 = data.x;
	const y1 = data.y;
	const x2 = data.x + data.width;
	const y2 = data.y + data.height;

	const dx = x2 - x1;
	const dy = y2 - y1;
	const lengthSq = dx * dx + dy * dy;

	if (lengthSq === 0) {
		const d = Math.hypot(point.x - x1, point.y - y1);
		return d <= tolerance;
	}

	let t = ((point.x - x1) * dx + (point.y - y1) * dy) / lengthSq;
	t = Math.max(0, Math.min(1, t));

	const nearestX = x1 + t * dx;
	const nearestY = y1 + t * dy;
	const dist = Math.hypot(point.x - nearestX, point.y - nearestY);
	return dist <= tolerance;
}
