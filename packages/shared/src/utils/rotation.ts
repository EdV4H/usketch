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
 * 角度を (-180, 180] の範囲に正規化する（向き・カメラ回転用）。
 */
export function wrapDeg(deg: number): number {
	if (!Number.isFinite(deg)) return 0;
	const w = ((((deg + 180) % 360) + 360) % 360) - 180;
	return w === -180 ? 180 : w + 0; // `+ 0` folds -0 into 0
}

/**
 * `from` から `to` へ回る最短の符号付き角度差（度, (-180, 180]）。
 * 例: 170 → -170 は +20。
 */
export function shortestAngleDelta(from: number, to: number): number {
	return wrapDeg(to - from);
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
 * 回転したシェイプのローカル（回転前）座標で計算した箱を、画面上のどこに置くかを返す。
 *
 * シェイプは自分の中心まわりに回転して描かれるため、回転したまま幅・高さを変えると
 * 中心が動き、回転前の座標で固定したはずの辺や角が画面上では滑ってしまう。リサイズなどは
 * 「操作開始時のシェイプの中心（`pivot`）と回転角で決まるローカル座標系」で箱を計算し、
 * 最後にこの関数で x/y を求める。返す x/y で描くと、箱の中心は `pivot` まわりに `angleDeg`
 * 回した位置に来る（幅・高さはそのまま）。回転 0 のときは `local` の x/y をそのまま返す。
 */
export function placeLocalBox(local: BoundingBox, pivot: Point, angleDeg: number): Point {
	const rotation = safeRotation(angleDeg);
	if (rotation === 0) return { x: local.x, y: local.y };
	const center = rotatePoint(
		{ x: local.x + local.width / 2, y: local.y + local.height / 2 },
		pivot,
		(rotation * Math.PI) / 180,
	);
	return { x: center.x - local.width / 2, y: center.y - local.height / 2 };
}

/**
 * 回転したシェイプの大きさを `width` × `height` に変えるとき、画面上の左上の角
 * （回転前の左上が回転して来た位置）を動かさない x/y を返す。回転していなければ `null`。
 * テキスト入力で付箋やテキストが伸びるときなどに使う。
 */
export function keepRotatedTopLeft(
	shape: { x: number; y: number; width: number; height: number; rotation?: unknown },
	width: number,
	height: number,
): Point | null {
	const rotation = safeRotation(shape.rotation);
	if (rotation === 0) return null;
	const pivot = { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
	return placeLocalBox({ x: shape.x, y: shape.y, width, height }, pivot, rotation);
}

/**
 * シェイプの箱（既定は x/y/width/height、`bounds` を渡せばその箱）の 4 隅を、画面上の
 * 位置（シェイプの中心まわりに `rotation` 回した位置）で返す。順序は左上・右上・右下・左下
 * （回転前の向きで）。回転していなければ箱の 4 隅そのもの。
 */
export function getShapeCorners(
	shape: { x: number; y: number; width: number; height: number; rotation?: unknown },
	bounds: BoundingBox = shape,
): Point[] {
	const corners: Point[] = [
		{ x: bounds.x, y: bounds.y },
		{ x: bounds.x + bounds.width, y: bounds.y },
		{ x: bounds.x + bounds.width, y: bounds.y + bounds.height },
		{ x: bounds.x, y: bounds.y + bounds.height },
	];
	const rotation = safeRotation(shape.rotation);
	if (rotation === 0) return corners;
	const center = { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
	const rad = (rotation * Math.PI) / 180;
	return corners.map((c) => rotatePoint(c, center, rad));
}

/**
 * シェイプが画面上で占める軸平行の外接矩形（回転込み）。スナップ・範囲選択・
 * 表示範囲の判定など、回転前の箱ではなく見えている範囲で比べたいときに使う。
 */
export function getShapeWorldAABB(
	shape: { x: number; y: number; width: number; height: number; rotation?: unknown },
	bounds: BoundingBox = shape,
): BoundingBox {
	if (safeRotation(shape.rotation) === 0) {
		return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
	}
	const corners = getShapeCorners(shape, bounds);
	let minX = corners[0].x;
	let minY = corners[0].y;
	let maxX = minX;
	let maxY = minY;
	for (const c of corners) {
		if (c.x < minX) minX = c.x;
		if (c.y < minY) minY = c.y;
		if (c.x > maxX) maxX = c.x;
		if (c.y > maxY) maxY = c.y;
	}
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * 軸平行の矩形 `rect` と、回転したシェイプの箱（{@link getShapeCorners}）が重なるか。
 * 分離軸判定なので、斜めのシェイプの外接矩形の空いた隅だけにかかる矩形は重ならない。
 */
export function rectIntersectsShape(
	rect: BoundingBox,
	shape: { x: number; y: number; width: number; height: number; rotation?: unknown },
	bounds: BoundingBox = shape,
): boolean {
	const aabb = getShapeWorldAABB(shape, bounds);
	const overlaps =
		rect.x < aabb.x + aabb.width &&
		rect.x + rect.width > aabb.x &&
		rect.y < aabb.y + aabb.height &&
		rect.y + rect.height > aabb.y;
	if (!overlaps || safeRotation(shape.rotation) === 0) return overlaps;
	// The rect's own axes are covered by the AABB test; check the shape's two axes.
	const quad = getShapeCorners(shape, bounds);
	const rectCorners: Point[] = [
		{ x: rect.x, y: rect.y },
		{ x: rect.x + rect.width, y: rect.y },
		{ x: rect.x + rect.width, y: rect.y + rect.height },
		{ x: rect.x, y: rect.y + rect.height },
	];
	for (let i = 0; i < 2; i++) {
		const axis = { x: quad[i + 1].x - quad[i].x, y: quad[i + 1].y - quad[i].y };
		const project = (p: Point) => p.x * axis.x + p.y * axis.y;
		const q = quad.map(project);
		const r = rectCorners.map(project);
		if (Math.max(...r) < Math.min(...q) || Math.min(...r) > Math.max(...q)) return false;
	}
	return true;
}

/**
 * 点がシェイプの箱（回転込み）の中にあるか。点をシェイプの中心まわりに逆回転して
 * 回転前の箱と比べる。
 */
export function shapeBoxContainsPoint(
	shape: { x: number; y: number; width: number; height: number; rotation?: unknown },
	point: Point,
	bounds: BoundingBox = shape,
): boolean {
	const rotation = safeRotation(shape.rotation);
	const p =
		rotation === 0
			? point
			: unrotatePoint(
					point,
					{ x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 },
					(rotation * Math.PI) / 180,
				);
	// A hair of slack so a point exactly on an edge of a turned box (rounding) counts.
	const eps = rotation === 0 ? 0 : 1e-6;
	return (
		p.x >= bounds.x - eps &&
		p.x <= bounds.x + bounds.width + eps &&
		p.y >= bounds.y - eps &&
		p.y <= bounds.y + bounds.height + eps
	);
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
