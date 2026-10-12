import {
	type BoardStore,
	generateId,
	type ShapeData,
	type ShapeRegistry,
} from "@edv4h/usketch-shared";

/**
 * `ids` の shape とその子孫（frame / group の中身）をすべて集める。
 * 返り値は store の挿入順（親が先）で、同じ shape は 1 度だけ含む。
 */
export function collectWithDescendants(store: BoardStore, ids: Iterable<string>): ShapeData[] {
	const included = new Set<string>();
	for (const id of ids) {
		if (store.getShape(id)) included.add(id);
	}
	// 親子関係が見つからなくなるまで広げる（入れ子の深さぶん回る）。
	let grew = included.size > 0;
	while (grew) {
		grew = false;
		for (const [id, shape] of store.getShapes()) {
			if (included.has(id)) continue;
			if (typeof shape.parentId === "string" && included.has(shape.parentId)) {
				included.add(id);
				grew = true;
			}
		}
	}
	const result: ShapeData[] = [];
	for (const [id, shape] of store.getShapes()) {
		if (included.has(id)) result.push({ ...shape });
	}
	return result;
}

/**
 * 両端（`sourceId` / `targetId`）がともに `ids` に含まれるコネクタのうち、`ids` に無いもの。
 * コネクタは frame の子にならないので、frame を複製するときはこれで中の矢印を拾う。
 */
export function connectorsBetween(store: BoardStore, ids: Iterable<string>): ShapeData[] {
	const set = new Set(ids);
	const result: ShapeData[] = [];
	for (const [id, shape] of store.getShapes()) {
		if (set.has(id)) continue;
		const { sourceId, targetId } = shape as { sourceId?: unknown; targetId?: unknown };
		if (typeof sourceId !== "string" || typeof targetId !== "string") continue;
		if (set.has(sourceId) && set.has(targetId)) result.push({ ...shape });
	}
	return result;
}

/** 親が `shapes` に含まれない shape（＝複製の起点）の id。確定後の選択に使う。 */
export function rootShapeIds(shapes: readonly ShapeData[]): string[] {
	const ids = new Set(shapes.map((s) => s.id));
	return shapes
		.filter((s) => typeof s.parentId !== "string" || !ids.has(s.parentId))
		.map((s) => s.id);
}

/**
 * shape を (dx, dy) 平行移動する。`ShapeDefinition.move`（コネクタの endpoints など
 * 絶対座標フィールドも動かす）があればそれを使い、無ければ x/y のみ更新する。
 */
export function translateShape(
	shape: ShapeData,
	dx: number,
	dy: number,
	registry?: ShapeRegistry,
): ShapeData {
	const move = registry?.get(shape.type)?.move;
	if (move) return { ...shape, ...move(shape, dx, dy) };
	return { ...shape, x: shape.x + dx, y: shape.y + dy };
}

export interface CloneShapesOptions {
	dx?: number;
	dy?: number;
	registry?: ShapeRegistry;
}

/**
 * shape 群を新 id で複製する。複製対象どうしの参照（`parentId` と
 * コネクタの `sourceId` / `targetId`）は複製先へ張り替え、対象外を指す参照は元のまま残す。
 */
export function cloneShapes(
	shapes: readonly ShapeData[],
	opts: CloneShapesOptions = {},
): { shapes: ShapeData[]; idMap: Map<string, string> } {
	const { dx = 0, dy = 0, registry } = opts;
	const idMap = new Map<string, string>();
	for (const shape of shapes) idMap.set(shape.id, generateId());

	const cloned = shapes.map((shape) => {
		const refs = shape as { parentId?: unknown; sourceId?: unknown; targetId?: unknown };
		const next: ShapeData = {
			...translateShape(shape, dx, dy, registry),
			id: idMap.get(shape.id) ?? shape.id,
		};
		for (const key of ["parentId", "sourceId", "targetId"] as const) {
			const ref = refs[key];
			const mapped = typeof ref === "string" ? idMap.get(ref) : undefined;
			if (mapped) Object.assign(next, { [key]: mapped });
		}
		return next;
	});
	return { shapes: cloned, idMap };
}
