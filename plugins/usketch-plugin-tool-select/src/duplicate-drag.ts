import {
	type BoardStore,
	type BoundingBox,
	compareZIndex,
	type LayerRenderContext,
	type ShapeData,
	type ShapeRegistry,
} from "@edv4h/usketch-shared";
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
 * Option(Alt)+ドラッグ複製のプレビュー（「その場に残る側」）を描くための LayerRenderContext。
 * プレビューは store に入れず、開始時のスナップショットだけを既存の shape 描画で表示する。
 */
export function previewRenderContext(
	base: LayerRenderContext,
	snapshots: readonly ShapeData[],
): LayerRenderContext {
	// 表示専用: 編集中のスナップショットがテキストエディタを出してフォーカスを奪わないようにする。
	const inert = snapshots.map((s) =>
		(s as { isEditing?: unknown }).isEditing === true ? { ...s, isEditing: false } : s,
	);
	return {
		...base,
		shapes: new Map(inert.map((s) => [s.id, s])),
		shapesSorted: [...inert].sort((a, b) => compareZIndex(a.zIndex, b.zIndex)),
		selection: new Set(),
		hoveredShapeId: null,
	};
}

/**
 * プレビュー（開始位置）をスナップ候補として渡す矩形。複製を元と揃えて置けるようにする。
 * スナップ対象と同じく、最上位の shape だけ（子は親フレーム内の文脈なので除く）、コネクタは除く。
 */
export function previewSnapCandidates(
	snapshots: readonly ShapeData[],
	registry?: ShapeRegistry,
): BoundingBox[] {
	const ids = new Set(snapshots.map((s) => s.id));
	return snapshots
		.filter((s) => s.type !== "connector")
		.filter((s) => typeof s.parentId !== "string" || !ids.has(s.parentId))
		.map(
			(s) =>
				registry?.get(s.type)?.getBounds(s) ?? { x: s.x, y: s.y, width: s.width, height: s.height },
		);
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
