import { type BoardStore, type ShapeData, zIndexBetween } from "@edv4h/usketch-shared";
import { cloneShapes, connectorsBetween } from "@edv4h/usketch-store";

/**
 * Option(Alt)+ドラッグで複製する shape の id。ドラッグで動く shape（選択＋子孫）に、
 * それらを結ぶコネクタを加える（コネクタは frame の子にならず movingIds に入らないため）。
 */
export function duplicateTargetIds(store: BoardStore, movingIds: Iterable<string>): string[] {
	const ids = [...movingIds];
	return [...ids, ...connectorsBetween(store, ids).map((s) => s.id)];
}

/**
 * Option(Alt)+ドラッグ複製のプレビュー。ドラッグ中は元の shape がカーソルに付いて動くので、
 * 「その場に残る側」の見た目として開始位置のコピーを store に直接置く（履歴には積まない）。
 * 返り値の id はドラッグ終了・Option 解除時に {@link removeShapes} で消す。
 */
export function addDuplicatePreview(
	store: BoardStore,
	startShapes: readonly ShapeData[],
): string[] {
	// 元と同じ zIndex だと後から追加したプレビューが前面に来て、ドラッグ中の元を隠す。
	// 各プレビューを元の直下（ひとつ手前の key との間）に差し込む。
	const keys = store
		.getShapesSorted()
		.map((s) => s.zIndex)
		.filter((k): k is string => typeof k === "string");
	const { shapes } = cloneShapes(startShapes);
	for (const shape of shapes) {
		const own = shape.zIndex;
		if (typeof own === "string") {
			const lower = keys.filter((k) => k < own).at(-1) ?? null;
			shape.zIndex = zIndexBetween(lower, own);
		}
		store.addShape(shape);
	}
	return shapes.map((s) => s.id);
}

export function removeShapes(store: BoardStore, ids: Iterable<string>): void {
	for (const id of ids) store.deleteShape(id);
}

/** snapshot の状態へ shape を書き戻す（履歴には積まない）。 */
export function restoreShapes(store: BoardStore, snapshots: readonly ShapeData[]): void {
	for (const snapshot of snapshots) {
		if (store.getShape(snapshot.id)) store.updateShape(snapshot.id, snapshot);
	}
}

/**
 * ドロップ時点の位置で moving shape 群を複製した shape を返す（store は変更しない）。
 * 呼び出し側は元を開始位置へ戻し、返り値を 1 コマンドで追加する。
 */
export function cloneAtCurrentPositions(store: BoardStore, ids: Iterable<string>): ShapeData[] {
	const current: ShapeData[] = [];
	for (const id of ids) {
		const shape = store.getShape(id);
		if (shape) current.push({ ...shape });
	}
	return cloneShapes(current).shapes;
}
