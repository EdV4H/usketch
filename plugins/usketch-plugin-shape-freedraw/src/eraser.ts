import type { BoardStore, Command, Point, ShapeData } from "@edv4h/usketch-shared";
import { eraserHits } from "./shape.js";
import type { FreedrawShapeData } from "./types.js";

/**
 * 複数ストロークの削除を1アクションとして undo 可能にする command。
 * store にバッチ削除 API が無いため自前で用意（設計書 §8,§9）。
 * ドラッグ中はプレビューのため直接 delete 済みなので、execute の delete は no-op になり得る（安全）。
 */
export function createEraseStrokesCommand(store: BoardStore, removed: ShapeData[]): Command {
	// id 衝突や二重適用に備えてスナップショットをコピー保持。
	const snapshots = removed.map((s) => ({ ...s }));
	return {
		execute() {
			for (const s of snapshots) store.deleteShape(s.id);
		},
		undo() {
			for (const s of snapshots) store.addShape(s);
		},
	};
}

/** 消しゴム円に触れた freedraw ストロークを返す（freedraw 型のみ対象）。 */
export function findErasedStrokes(
	store: BoardStore,
	cursor: Point,
	eraserSize: number,
): ShapeData[] {
	const r = eraserSize / 2 + 1;
	const out: ShapeData[] = [];
	for (const [, shape] of store.getShapes()) {
		if (shape.type !== "freedraw") continue;
		if (eraserHits(shape as FreedrawShapeData, cursor, r)) out.push(shape);
	}
	return out;
}
