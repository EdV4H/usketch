import type { BoundingBox, Point } from "../types/geometry.js";
import type { ShapeData } from "../types/shape.js";

/** rotation 値を安全な有限数に変換する（NaN/Infinity/非数値 → 0） */
export function safeRotation(value: unknown): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return 0;
	return value;
}

/**
 * 点を中心周りに回転する。
 * @param point 回転する点
 * @param center 回転中心
 * @param angleRad 回転角度（ラジアン、正 = 時計回り）
 */
export function rotatePoint(point: Point, center: Point, angleRad: number): Point {
	const cos = Math.cos(angleRad);
	const sin = Math.sin(angleRad);
	const dx = point.x - center.x;
	const dy = point.y - center.y;
	return {
		x: center.x + dx * cos - dy * sin,
		y: center.y + dx * sin + dy * cos,
	};
}

/**
 * 点を中心周りに逆回転する（ヒットテスト用）。
 * rotatePoint の逆操作。
 */
export function unrotatePoint(point: Point, center: Point, angleRad: number): Point {
	return rotatePoint(point, center, -angleRad);
}

/**
 * 回転した矩形の軸平行バウンディングボックス（AABB）を計算する。
 * 4頂点を回転して min/max を取る。
 */
export function getRotatedAABB(bounds: BoundingBox, angleDeg: number): BoundingBox {
	if (angleDeg === 0) return bounds;

	const angleRad = (angleDeg * Math.PI) / 180;
	const cx = bounds.x + bounds.width / 2;
	const cy = bounds.y + bounds.height / 2;
	const center: Point = { x: cx, y: cy };

	const corners: Point[] = [
		{ x: bounds.x, y: bounds.y },
		{ x: bounds.x + bounds.width, y: bounds.y },
		{ x: bounds.x + bounds.width, y: bounds.y + bounds.height },
		{ x: bounds.x, y: bounds.y + bounds.height },
	];

	const rotated = corners.map((c) => rotatePoint(c, center, angleRad));

	let minX = rotated[0].x;
	let minY = rotated[0].y;
	let maxX = rotated[0].x;
	let maxY = rotated[0].y;

	for (let i = 1; i < rotated.length; i++) {
		if (rotated[i].x < minX) minX = rotated[i].x;
		if (rotated[i].y < minY) minY = rotated[i].y;
		if (rotated[i].x > maxX) maxX = rotated[i].x;
		if (rotated[i].y > maxY) maxY = rotated[i].y;
	}

	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * 角度を 0–360 の範囲に正規化する。
 */
export function normalizeAngle(deg: number): number {
	const mod = deg % 360;
	return mod < 0 ? mod + 360 : mod;
}

/**
 * 角度を最近傍の step 倍数にスナップする。
 * @param deg 角度（度）
 * @param step スナップ間隔（例: 15）
 */
export function snapAngle(deg: number, step: number): number {
	return Math.round(deg / step) * step;
}

/**
 * ワールド空間のデルタベクトルをローカル（非回転）空間に変換する。
 * 回転中のリサイズで使用。
 */
export function deltaToLocal(delta: Point, angleDeg: number): Point {
	if (angleDeg === 0) return delta;
	const angleRad = (-angleDeg * Math.PI) / 180;
	const cos = Math.cos(angleRad);
	const sin = Math.sin(angleRad);
	return {
		x: delta.x * cos - delta.y * sin,
		y: delta.x * sin + delta.y * cos,
	};
}

/**
 * ヒットテスト関数を回転対応にラップする。
 * シェイプが回転している場合、テスト対象の点をシェイプ中心周りに逆回転してから判定する。
 */
export function withRotation(
	hitTestFn: (data: ShapeData, point: Point) => boolean,
): (data: ShapeData, point: Point) => boolean {
	return (data, point) => {
		const rotation = safeRotation(data.rotation);
		if (rotation === 0) return hitTestFn(data, point);
		const center = { x: data.x + data.width / 2, y: data.y + data.height / 2 };
		const unrotated = unrotatePoint(point, center, (rotation * Math.PI) / 180);
		return hitTestFn(data, unrotated);
	};
}
