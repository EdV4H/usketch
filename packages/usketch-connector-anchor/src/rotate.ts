import type { Point, ShapeData } from "@edv4h/usketch-shared";
import { rotatePoint } from "@edv4h/usketch-shared";
import { getBoundsConnector } from "./hit-test.js";
import type { ConnectableShapeData } from "./types.js";

/**
 * コネクタを `center` まわりに `angleRad`（正=時計回り）回転する差分を返す
 * （`ShapeDefinition.rotate` 用）。
 *
 * コネクタの形状は `sourcePoint` / `targetPoint` / `controlPoint`（絶対座標）で
 * 定義されるため、グループ回転で `rotation` を焼き込むと「端点＋回転」の二重変換に
 * なって線が本体から外れる。ここでは各 Point を回転させ、AABB を再計算するだけで、
 * `rotation` は据え置く（＝コネクタは常に rotation=0、向きは端点が表す）。
 */
export function rotateConnector(
	data: ShapeData,
	angleRad: number,
	center: Point,
): Partial<ShapeData> {
	const c = data as ConnectableShapeData;
	const patch: Partial<ConnectableShapeData> = {};
	if (c.sourcePoint) patch.sourcePoint = rotatePoint(c.sourcePoint, center, angleRad);
	if (c.targetPoint) patch.targetPoint = rotatePoint(c.targetPoint, center, angleRad);
	if (c.controlPoint) patch.controlPoint = rotatePoint(c.controlPoint, center, angleRad);

	// Recompute the axis-aligned bbox from the rotated geometry so the renderer's
	// viewBox / wrapper (which read x/y/width/height) stay in sync with the points.
	const bounds = getBoundsConnector({ ...data, ...patch } as ShapeData);
	patch.x = bounds.x;
	patch.y = bounds.y;
	patch.width = bounds.width;
	patch.height = bounds.height;
	return patch as Partial<ShapeData>;
}
