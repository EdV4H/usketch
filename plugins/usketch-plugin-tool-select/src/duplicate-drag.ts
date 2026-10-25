import type { BoardStore, Command, ShapeData } from "@edv4h/usketch-shared";
import {
	cloneShapes,
	connectorsBetween,
	createAddShapesCommand,
	findAttachParent,
} from "@edv4h/usketch-store";

/**
 * Option(Alt)+ドラッグで複製する shape の id。ドラッグで動く shape（選択＋子孫）に、
 * それらを結ぶコネクタを加える（コネクタは frame の子にならず movingIds に入らないため）。
 */
export function duplicateTargetIds(store: BoardStore, movingIds: Iterable<string>): string[] {
	const ids = [...movingIds];
	return [...ids, ...connectorsBetween(store, ids).map((s) => s.id)];
}

/**
 * Option(Alt)+ドラッグ中の複製。元はその場に残り、ドラッグはこの複製を動かす
 * （Figma と同じ。共同編集の相手にも複製が動いて見える）。
 */
export interface DragCopies {
	/** 複製（store への追加順。親が先）。 */
	shapes: ShapeData[];
	/** 選択されていた shape の複製の id。ドラッグで動かし、確定後に選択する。 */
	rootIds: string[];
}

/**
 * 親が複製に含まれない shape（複製の起点）の `parentId` を、containment-attacher と
 * 同じ規則（それを完全に含む最小の autoAttach コンテナ）で決め直す。追加時に attacher が
 * 別の reparent コマンドを積まないようにするため。コネクタと autoAttach コンテナ自身は対象外。
 */
export function resolveCopyParents(
	store: BoardStore,
	shapes: readonly ShapeData[],
	isAttachTarget: (shape: ShapeData) => boolean,
): ShapeData[] {
	const ids = new Set(shapes.map((s) => s.id));
	return shapes.map((shape) => {
		if (typeof shape.parentId === "string" && ids.has(shape.parentId)) return shape;
		if (shape.type === "connector" || isAttachTarget(shape)) return shape;
		const parent = findAttachParent(store, shape, isAttachTarget);
		const parentId = parent?.id;
		if (parentId === shape.parentId) return shape;
		return { ...shape, parentId } as ShapeData;
	});
}

/** 親が先に来るように並べる（同じ集合内の `parentId` だけを見る安定ソート）。 */
function parentsFirst(shapes: readonly ShapeData[]): ShapeData[] {
	const byId = new Map(shapes.map((s) => [s.id, s]));
	const done = new Set<string>();
	const result: ShapeData[] = [];
	const visit = (shape: ShapeData, depth: number) => {
		if (done.has(shape.id)) return;
		done.add(shape.id);
		const parent = typeof shape.parentId === "string" ? byId.get(shape.parentId) : undefined;
		// depth guards a parentId cycle in corrupt data.
		if (parent && depth < shapes.length) visit(parent, depth + 1);
		result.push(shape);
	};
	for (const shape of shapes) visit(shape, 0);
	return result;
}

/**
 * ドラッグで動く shape（`movingIds`）の複製を元と同じ位置に store へ直接追加する
 * （履歴には積まない。確定は {@link commitDragCopies}、取り消しは {@link removeDragCopies}）。
 */
export function addDragCopies(
	store: BoardStore,
	selectedIds: Iterable<string>,
	movingIds: Iterable<string>,
	isAttachTarget: (shape: ShapeData) => boolean,
): DragCopies {
	const originals = duplicateTargetIds(store, movingIds).flatMap((id) => {
		const shape = store.getShape(id);
		return shape ? [{ ...shape }] : [];
	});
	const { shapes: cloned, idMap } = cloneShapes(originals);
	const shapes = parentsFirst(resolveCopyParents(store, cloned, isAttachTarget));
	for (const shape of shapes) store.addShape(shape);
	const rootIds = [...selectedIds].flatMap((id) => {
		const copyId = idMap.get(id);
		return copyId ? [copyId] : [];
	});
	return { shapes, rootIds };
}

/** ドラッグ中の複製を store から取り除く（履歴には積まない）。 */
export function removeDragCopies(store: BoardStore, copies: DragCopies): void {
	for (let i = copies.shapes.length - 1; i >= 0; i--) {
		const shape = copies.shapes[i];
		if (shape) store.deleteShape(shape.id);
	}
}

/**
 * ドロップ時: 複製をいまの位置のまま 1 つの undo 可能な追加コマンドに置き換える。
 * 複製をいったん store から取り除き、追加し直すコマンドを返す（呼び出し側が execute する）。
 */
export function commitDragCopies(
	store: BoardStore,
	copies: DragCopies,
	isAttachTarget: (shape: ShapeData) => boolean,
): Command {
	const current = copies.shapes.flatMap((s) => {
		const shape = store.getShape(s.id);
		return shape ? [{ ...shape }] : [];
	});
	const placed = parentsFirst(resolveCopyParents(store, current, isAttachTarget));
	removeDragCopies(store, copies);
	return createAddShapesCommand(store, placed);
}
