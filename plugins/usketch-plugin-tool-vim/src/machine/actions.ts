import { DEFAULT_STYLE, generateId, type ShapeData } from "@edv4h/usketch-shared";
import { createAddShapeCommand, createDeleteShapeCommand } from "@edv4h/usketch-store";
import type { ShapeCandidate, VimContext, VimDeps } from "./types.js";

/** count を実効値に（未入力なら 1）。 */
export function effectiveCount(ctx: VimContext): number {
	return ctx.count ?? 1;
}

/**
 * 削除/yank の対象 ID。選択があれば選択、無ければカーソル最近傍 1 つ。
 * （`findNearestShape` は cursor.ts にあるが循環を避けるため呼び出し側で渡す）
 */
export function resolveTargets(ctx: VimContext, nearestId: string | null): string[] {
	const sel = [...ctx.deps.store.getSelection()];
	if (sel.length > 0) return sel;
	return nearestId ? [nearestId] : [];
}

/** 候補から実際の ShapeData を生成（createDefault + spec 上書き）。 */
export function buildShapeFromCandidate(
	deps: VimDeps,
	candidate: ShapeCandidate,
	at: { x: number; y: number },
): ShapeData | null {
	const def = deps.shapes.get(candidate.spec.type);
	if (!def) return null;
	const id = generateId();
	const base = def.createDefault({ id, x: at.x, y: at.y });
	const spec = candidate.spec;
	const next: ShapeData = {
		...base,
		width: spec.width ?? base.width,
		height: spec.height ?? base.height,
		style: { ...DEFAULT_STYLE, ...base.style, ...(spec.style ?? {}) },
	};
	if (spec.meta) {
		next.meta = { ...(base.meta ?? {}), ...spec.meta };
	}
	return next;
}

/** insert: 選択中の候補をカーソル位置に確定する。 */
export function commitCandidate(ctx: VimContext): void {
	const candidate = ctx.candidates[ctx.candidateIndex];
	if (!candidate) return;
	const shape = buildShapeFromCandidate(ctx.deps, candidate, ctx.cursor);
	if (!shape) return;
	ctx.deps.commands.execute(createAddShapeCommand(ctx.deps.store, shape));
}

/** 対象 shape を削除（undo 可能）。 */
export function deleteShapes(deps: VimDeps, ids: string[]): void {
	for (const id of ids) {
		deps.commands.execute(createDeleteShapeCommand(deps.store, id));
	}
}

/** 対象 shape のスナップショットを返す（yank 用、ディープコピー）。 */
export function snapshotShapes(deps: VimDeps, ids: string[]): ShapeData[] {
	const out: ShapeData[] = [];
	for (const id of ids) {
		const s = deps.store.getShape(id);
		if (s) out.push(structuredClone(s));
	}
	return out;
}

/** register の shape をカーソル付近に貼り付け、新 ID を採番する。 */
export function pasteShapes(ctx: VimContext): string[] {
	const { register, deps, cursor } = ctx;
	if (register.length === 0) return [];
	// register の重心を基準にカーソルへ移動。
	let cx = 0;
	let cy = 0;
	for (const s of register) {
		cx += s.x + s.width / 2;
		cy += s.y + s.height / 2;
	}
	cx /= register.length;
	cy /= register.length;
	const dx = cursor.x - cx;
	const dy = cursor.y - cy;
	const newIds: string[] = [];
	for (const s of register) {
		const id = generateId();
		// 新 ID を採番し、store が再付与する createdAt/updatedAt/zIndex と親子関係はリセット。
		const shape: ShapeData = {
			...s,
			id,
			x: s.x + dx,
			y: s.y + dy,
			createdAt: undefined,
			updatedAt: undefined,
			zIndex: undefined,
			parentId: undefined,
		};
		deps.commands.execute(createAddShapeCommand(deps.store, shape));
		newIds.push(id);
	}
	return newIds;
}
