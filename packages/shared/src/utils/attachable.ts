import type { ShapeDefinition } from "../types/plugin.js";
import type { ShapeData } from "../types/shape.js";

/**
 * Child-side counterpart to {@link isShapeContainer}. Resolves whether a shape
 * instance opts in as an "attachable" child — one that sticks to and follows any
 * shape it is dropped on (see {@link ShapeDefinition.attachable}).
 *
 * - no `attachable` object → `false` (not attachable)
 * - `attachable` present   → `true`  (specifying it opts in)
 *
 * Centralizes the rule so native move-follow and the attach plugin agree.
 */
export function isAttachable(def: ShapeDefinition | undefined, _shape: ShapeData): boolean {
	return def?.attachable !== undefined;
}

/**
 * Whether an attachable child follows its parent's move even when the parent is
 * not a container. Honors the `boolean | (data) => boolean` predicate form of
 * {@link ShapeDefinition.attachable.follow}. Defaults to `true` when `attachable`
 * is declared (attaching without following is rarely useful). Always `false` for
 * non-attachable shapes.
 */
export function isAttachableFollow(def: ShapeDefinition | undefined, shape: ShapeData): boolean {
	const a = def?.attachable;
	if (!a) return false;
	const f = a.follow;
	if (f === undefined) return true;
	return typeof f === "function" ? f(shape) : f === true;
}

/**
 * The hit-test mode used to detect the attach target on drop. `"center"` (the
 * default) sticks when the child's center lands inside a target; `"contain"`
 * requires full containment. Meaningless for non-attachable shapes but defaults
 * to `"center"` regardless.
 */
export function getAttachableHitTest(
	def: ShapeDefinition | undefined,
	_shape: ShapeData,
): "center" | "contain" {
	return def?.attachable?.hitTest ?? "center";
}

/**
 * Whether an attachable `shape` may attach to a given `target`, honoring the
 * `boolean | (target) => boolean` predicate form of
 * {@link ShapeDefinition.attachable.toAny}. Defaults to `true` when `attachable`
 * is declared. Always `false` for non-attachable shapes.
 */
export function attachableAcceptsTarget(
	def: ShapeDefinition | undefined,
	_shape: ShapeData,
	target: ShapeData,
): boolean {
	const a = def?.attachable;
	if (!a) return false;
	const t = a.toAny;
	if (t === undefined) return true;
	return typeof t === "function" ? t(target) : t === true;
}
