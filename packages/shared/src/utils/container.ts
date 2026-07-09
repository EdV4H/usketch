import type { ShapeDefinition } from "../types/plugin.js";
import type { ShapeData } from "../types/shape.js";

/**
 * Resolve whether a shape instance acts as a container, honoring the
 * `boolean | (data) => boolean` predicate form of
 * {@link ShapeDefinition.container.enabled}.
 *
 * - no `container` object   → `false` (not a container)
 * - `enabled` undefined     → `true`  (specifying `container` opts in)
 * - `boolean`               → that value
 * - `(data) => boolean`     → evaluated against the shape instance
 *
 * Centralizes the rule so selection resolution, descendant follow, snap, and
 * the containment attacher all agree on what counts as a container — replacing
 * the old hardcoded `frame`/`island`/`group` type checks.
 */
export function isShapeContainer(def: ShapeDefinition | undefined, shape: ShapeData): boolean {
	const c = def?.container;
	if (!c) return false;
	const e = c.enabled;
	if (e === undefined) return true;
	return typeof e === "function" ? e(shape) : e === true;
}

/**
 * Resolve whether a container's children are individually selectable /
 * resizable (frame/island behavior) versus selecting the whole container
 * (group behavior). Always `false` for non-containers.
 */
export function hasSelectableChildren(def: ShapeDefinition | undefined, shape: ShapeData): boolean {
	if (!isShapeContainer(def, shape)) return false;
	const s = def?.container?.selectableChildren;
	return typeof s === "function" ? s(shape) : s === true;
}

/**
 * Resolve whether a container auto-attaches shapes dropped inside it as
 * children (frame-style), versus managing membership itself (group/island).
 * Always `false` for non-containers.
 */
export function isContainerAutoAttach(def: ShapeDefinition | undefined, shape: ShapeData): boolean {
	if (!isShapeContainer(def, shape)) return false;
	const a = def?.container?.autoAttach;
	return typeof a === "function" ? a(shape) : a === true;
}

/** The container's child-layout function, or `undefined` if it uses free positioning. */
export function getContainerLayout(def: ShapeDefinition | undefined) {
	return def?.container?.layout;
}
