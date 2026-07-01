import type { Point, ShapeData } from "@edv4h/usketch-shared";
import type { ConnectableShapeData } from "./types.js";

function shiftPoint(p: Point | undefined, dx: number, dy: number): Point | undefined {
	return p ? { x: p.x + dx, y: p.y + dy } : undefined;
}

/**
 * コネクタを (dx, dy) 平行移動するための差分を返す（`ShapeDefinition.move` 用）。
 *
 * コネクタは bounds を `sourcePoint` / `targetPoint` / `controlPoint`（絶対座標）から
 * 導出する（{@link getBoundsConnector}）ため、x/y だけを動かすと endpoints が取り残されて
 * 形状が崩れる。ここで x/y に加えて保持している Point フィールドも同じオフセットで移動する。
 * 未設定の Point は省略する（`sourceXY`/`targetXY` が x/y にフォールバックするため整合する）。
 */
export function moveConnector(data: ShapeData, dx: number, dy: number): Partial<ShapeData> {
	const c = data as ConnectableShapeData;
	const patch: Partial<ConnectableShapeData> = { x: data.x + dx, y: data.y + dy };
	const sp = shiftPoint(c.sourcePoint, dx, dy);
	const tp = shiftPoint(c.targetPoint, dx, dy);
	const cp = shiftPoint(c.controlPoint, dx, dy);
	if (sp) patch.sourcePoint = sp;
	if (tp) patch.targetPoint = tp;
	if (cp) patch.controlPoint = cp;
	return patch as Partial<ShapeData>;
}
