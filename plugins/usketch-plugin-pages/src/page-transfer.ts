// ページをまたいでシェイプを移す・写す。2 つのページ doc にまたがるので、BoardStore ではなく
// ページ doc を受け取る純関数にする。
import { compareZIndex, type ShapeData, zIndexBetween } from "@edv4h/usketch-shared";
import { cloneShapes } from "@edv4h/usketch-store";
import { PAGE_SHAPES_MAP_KEY } from "@edv4h/usketch-sync";
import type * as Y from "yjs";

/**
 * ページ doc の `movedOut`（shapeId → 移動先の pageId）。別のページへ移したシェイプの印で、
 * 同時編集で移動元に戻ってきたシェイプを見つけて消すのに使う。
 */
export const MOVED_OUT_MAP_KEY = "movedOut";

function shapesOf(doc: Y.Doc): Y.Map<ShapeData> {
	return doc.getMap<ShapeData>(PAGE_SHAPES_MAP_KEY);
}

function movedOutOf(doc: Y.Doc): Y.Map<string> {
	return doc.getMap<string>(MOVED_OUT_MAP_KEY);
}

/** Y.Map に置く値（JSON の値）にする。 */
function plain<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

type Refs = { parentId?: unknown; sourceId?: unknown; targetId?: unknown };

/**
 * 移す・写す単位を集める: `ids` のシェイプ、その子孫（frame / group の中身）、両端が含まれる
 * コネクタ。重なり順（zIndex の昇順）で返す。
 */
export function collectTransferShapes(
	shapes: ReadonlyMap<string, ShapeData>,
	ids: Iterable<string>,
): ShapeData[] {
	const included = new Set<string>();
	for (const id of ids) if (shapes.has(id)) included.add(id);
	let grew = included.size > 0;
	while (grew) {
		grew = false;
		for (const [id, shape] of shapes) {
			if (included.has(id)) continue;
			const { parentId, sourceId, targetId } = shape as Refs;
			const child = typeof parentId === "string" && included.has(parentId);
			const between =
				typeof sourceId === "string" &&
				typeof targetId === "string" &&
				included.has(sourceId) &&
				included.has(targetId);
			if (child || between) {
				included.add(id);
				grew = true;
			}
		}
	}
	return [...shapes.values()]
		.filter((shape) => included.has(shape.id))
		.sort((a, b) => compareZIndex(a.zIndex, b.zIndex));
}

/**
 * `keep` に無いシェイプへの参照を外す。親が無ければ最上位に、コネクタの端は
 * その場の点（`sourcePoint` / `targetPoint`）に残る自由端にする。
 */
function cutOutside(shape: ShapeData, keep: ReadonlySet<string>): ShapeData {
	const refs = shape as Refs;
	const next = { ...shape } as Record<string, unknown>;
	if (typeof refs.parentId === "string" && !keep.has(refs.parentId)) delete next.parentId;
	if (typeof refs.sourceId === "string" && !keep.has(refs.sourceId)) {
		delete next.sourceId;
		delete next.sourceAnchorRatio;
	}
	if (typeof refs.targetId === "string" && !keep.has(refs.targetId)) {
		delete next.targetId;
		delete next.targetAnchorRatio;
	}
	return next as unknown as ShapeData;
}

/** `lower` の上の zIndex（壊れたキーなら、それを無視して作る）。 */
function nextAbove(lower: string | null): string {
	try {
		return zIndexBetween(lower, null);
	} catch {
		return zIndexBetween(null, null);
	}
}

/** 移動先の一番手前に並べる（重なり順は保つ）。 */
function placeOnTop(shapes: readonly ShapeData[], target: Y.Map<ShapeData>): ShapeData[] {
	let top: string | null = null;
	for (const shape of target.values()) {
		if (typeof shape?.zIndex === "string" && compareZIndex(shape.zIndex, top ?? undefined) > 0) {
			top = shape.zIndex;
		}
	}
	return shapes.map((shape) => {
		top = nextAbove(top);
		return { ...shape, zIndex: top };
	});
}

/**
 * `ids` のシェイプ（子孫と、両端が含まれるコネクタも）を別のページ doc へ写す。写したものは
 * 新しい id にし、写したものどうしの参照は張り替え、写さなかったものへの参照は外す。
 * 移動先の一番手前に置く。写したシェイプの（移動先での）id を返す。
 */
export function copyShapesToPage(from: Y.Doc, to: Y.Doc, ids: Iterable<string>): string[] {
	const picked = collectTransferShapes(new Map(shapesOf(from).entries()), ids);
	if (picked.length === 0) return [];
	const { shapes: cloned } = cloneShapes(picked);
	const keep = new Set(cloned.map((s) => s.id));
	const target = shapesOf(to);
	const placed = placeOnTop(
		cloned.map((s) => cutOutside(s, keep)),
		target,
	);
	to.transact(() => {
		for (const shape of placed) target.set(shape.id, plain(shape));
	});
	return placed.map((s) => s.id);
}

/**
 * `ids` のシェイプ（子孫と、両端が含まれるコネクタも）を別のページ doc へ移す。id は変えない。
 *
 * 1. 移動先に足す（移さなかったものへの参照は外す）。移動先の `movedOut` の印は消す
 * 2. 移動元に残るコネクタのうち、移したシェイプにつながる端を外す
 * 3. 移動元から消し、`movedOut` に移動先を記録する
 *
 * 先に移動先へ足すので、途中で止まっても消えることはない（両方に残ったら 3 をやり直せばよい）。
 * 2 と 3 を分けるのは、消したときにコネクタも一緒に消す仕組み（cascade-delete）より先に
 * 端を外しておくため。移したシェイプの id を返す。
 */
export function moveShapesToPage(
	from: Y.Doc,
	to: Y.Doc,
	ids: Iterable<string>,
	toPageId: string,
): string[] {
	const source = shapesOf(from);
	const picked = collectTransferShapes(new Map(source.entries()), ids);
	if (picked.length === 0) return [];
	const moved = new Set(picked.map((s) => s.id));
	const target = shapesOf(to);
	const placed = placeOnTop(
		picked.map((s) => cutOutside(s, moved)),
		target,
	);

	to.transact(() => {
		const marks = movedOutOf(to);
		for (const shape of placed) {
			target.set(shape.id, plain(shape));
			marks.delete(shape.id);
		}
	});

	from.transact(() => {
		for (const [id, shape] of source.entries()) {
			if (moved.has(id)) continue;
			const { sourceId, targetId } = shape as Refs;
			const touches =
				(typeof sourceId === "string" && moved.has(sourceId)) ||
				(typeof targetId === "string" && moved.has(targetId));
			if (touches) source.set(id, plain(cutOutside(shape, notIn(moved))));
		}
	});

	from.transact(() => {
		const marks = movedOutOf(from);
		for (const id of moved) {
			source.delete(id);
			marks.set(id, toPageId);
		}
	});
	return [...moved];
}

/** `set` に無いものを残す集合（cutOutside に渡す）。 */
function notIn(set: ReadonlySet<string>): ReadonlySet<string> {
	return { has: (id: string) => !set.has(id) } as ReadonlySet<string>;
}

/**
 * 別のページへ移したはずのシェイプ（`movedOut` に印がある）が残っていれば消す。
 * 同時編集で移動元に戻ってきたものを片付ける。消した数を返す。
 */
export function removeMovedOutShapes(doc: Y.Doc): number {
	const shapes = shapesOf(doc);
	const marks = movedOutOf(doc);
	const stale = [...marks.keys()].filter((id) => shapes.has(id));
	if (stale.length === 0) return 0;
	doc.transact(() => {
		for (const id of stale) shapes.delete(id);
	});
	return stale.length;
}

/**
 * ページ doc を見張り、別のページへ移したシェイプが戻ってきたら消す。今あるものも片付ける。
 * 見張りをやめる関数を返す。
 */
export function watchMovedOutShapes(doc: Y.Doc): () => void {
	const shapes = shapesOf(doc);
	const marks = movedOutOf(doc);
	const onChange = (event: Y.YMapEvent<ShapeData>) => {
		for (const [id, change] of event.changes.keys) {
			if (change.action !== "delete" && marks.has(id)) {
				removeMovedOutShapes(doc);
				return;
			}
		}
	};
	removeMovedOutShapes(doc);
	shapes.observe(onChange);
	return () => shapes.unobserve(onChange);
}
