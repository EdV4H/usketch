// The i3/sway-style tiling tree — a pure, React-free, immutable module (so the
// runtime, service, config, and the unit tests can all import it without pulling
// in the store or React). It models the fixed screen as a recursively-subdivided
// rectangle: an n-ary SPLIT container (oriented horizontally or vertically, each
// child taking a fraction of the parent's extent) whose leaves are WINDOWS
// (top-level shapes, addressed by id). `layoutTree` turns a tree + a screen rect
// into concrete per-window rectangles; the rest are structural edits (insert /
// remove / reorder / resize / re-split) that return a NEW tree, never mutating.
//
// Convention: a split's `dir` is its orientation —
//   - "h" (horizontal) → children sit SIDE BY SIDE along X (an i3 "split h" row),
//   - "v" (vertical)   → children STACK top-to-bottom along Y (an i3 "split v").
// so "split h" makes the next window open to the RIGHT, "split v" BELOW.

/** An axis-aligned rectangle in world (or screen) units. */
export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** A window's resolved rectangle, produced by {@link layoutTree}. */
export interface Placement {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Split orientation. "h" = side-by-side (X), "v" = stacked (Y). */
export type SplitDir = "h" | "v";

/** Geometric focus/move direction (independent of tree structure). */
export type FocusDir = "left" | "right" | "up" | "down";

/**
 * A node in the tiling tree: either a `leaf` (one window) or a `split` container
 * with ≥2 children laid out along `dir`, each child taking `fractions[i]` of the
 * container's extent. Fractions are kept roughly normalized on write and always
 * re-normalized on read ({@link layoutTree}), so a tree is robust to drift.
 */
export type TileNode =
	| { type: "leaf"; id: string }
	| { type: "split"; dir: SplitDir; children: TileNode[]; fractions: number[] };

/** An empty tree — no windows. Represented as a childless split (never a leaf). */
export function emptyTree(): TileNode {
	return { type: "split", dir: "h", children: [], fractions: [] };
}

/** True when the tree holds no windows. */
export function isEmpty(node: TileNode): boolean {
	return node.type === "split" && node.children.length === 0;
}

/** Normalize `fractions` to length `n`, all positive, summing to 1. */
function normalizeFractions(fractions: readonly number[] | undefined, n: number): number[] {
	if (n <= 0) return [];
	const base =
		fractions && fractions.length === n
			? fractions.map((f) => (Number.isFinite(f) && f > 0 ? f : 0))
			: new Array<number>(n).fill(1);
	let sum = base.reduce((a, b) => a + b, 0);
	if (sum <= 0) {
		base.fill(1);
		sum = n;
	}
	return base.map((f) => f / sum);
}

/** Collect every window id in the tree, in left-to-right / top-to-bottom order. */
export function leafIds(node: TileNode): string[] {
	if (node.type === "leaf") return [node.id];
	const out: string[] = [];
	for (const c of node.children) out.push(...leafIds(c));
	return out;
}

/** Whether `id` is a window in the tree. */
export function hasLeaf(node: TileNode, id: string): boolean {
	if (node.type === "leaf") return node.id === id;
	return node.children.some((c) => hasLeaf(c, id));
}

/**
 * Resolve every window's rectangle by recursively subdividing `rect`. A split
 * divides its extent (X for "h", Y for "v") among children by their fractions,
 * reserving `gap` between adjacent children. Empty splits contribute nothing.
 */
export function layoutTree(root: TileNode, rect: Rect, gap = 0): Placement[] {
	const out: Placement[] = [];
	const walk = (node: TileNode, r: Rect): void => {
		if (node.type === "leaf") {
			out.push({ id: node.id, x: r.x, y: r.y, width: r.width, height: r.height });
			return;
		}
		const n = node.children.length;
		if (n === 0) return;
		const fr = normalizeFractions(node.fractions, n);
		const totalGap = gap * (n - 1);
		if (node.dir === "h") {
			const avail = Math.max(0, r.width - totalGap);
			let x = r.x;
			for (let i = 0; i < n; i++) {
				const w = avail * fr[i];
				walk(node.children[i], { x, y: r.y, width: w, height: r.height });
				x += w + gap;
			}
		} else {
			const avail = Math.max(0, r.height - totalGap);
			let y = r.y;
			for (let i = 0; i < n; i++) {
				const h = avail * fr[i];
				walk(node.children[i], { x: r.x, y, width: r.width, height: h });
				y += h + gap;
			}
		}
	};
	walk(root, rect);
	return out;
}

/** Shrink `rect` inward by `padding` on every side (the outer margin between the
 *  fixed screen and the tiling area). Clamped so the result never goes negative. */
export function insetRect(rect: Rect, padding: number): Rect {
	const p = Math.max(0, padding);
	return {
		x: rect.x + p,
		y: rect.y + p,
		width: Math.max(0, rect.width - 2 * p),
		height: Math.max(0, rect.height - 2 * p),
	};
}

/** Build a flat tree that lays every window out along one `dir` split (equal
 *  fractions). One id → a bare leaf; none → an empty tree. */
export function buildDefaultTree(ids: readonly string[], dir: SplitDir = "h"): TileNode {
	if (ids.length === 0) return emptyTree();
	if (ids.length === 1) return { type: "leaf", id: ids[0] };
	return {
		type: "split",
		dir,
		children: ids.map((id) => ({ type: "leaf", id })),
		fractions: ids.map(() => 1 / ids.length),
	};
}

/** Append `child` to a split: as a sibling when `dir` matches, else wrap the
 *  whole split in a new `dir` split. New/existing shares are averaged. */
function appendTo(
	node: Extract<TileNode, { type: "split" }>,
	child: TileNode,
	dir: SplitDir,
): TileNode {
	if (node.dir === dir) {
		const n = node.children.length;
		const fr = normalizeFractions(node.fractions, n);
		const share = n > 0 ? 1 / (n + 1) : 1;
		return {
			...node,
			children: [...node.children, child],
			fractions: normalizeFractions([...fr, share], n + 1),
		};
	}
	return { type: "split", dir, children: [node, child], fractions: [0.5, 0.5] };
}

/** Try to insert `newId` next to the `focusId` leaf within `node`'s subtree;
 *  returns the rebuilt subtree, or null when focus isn't found here. */
function insertNear(
	node: Extract<TileNode, { type: "split" }>,
	focusId: string,
	newId: string,
	dir: SplitDir,
): TileNode | null {
	const idx = node.children.findIndex((c) => c.type === "leaf" && c.id === focusId);
	if (idx >= 0) {
		const children = [...node.children];
		if (node.dir === dir) {
			// Same orientation → drop the new window right after focus, splitting
			// focus's share between the two.
			const fr = normalizeFractions(node.fractions, children.length);
			const half = fr[idx] / 2;
			children.splice(idx + 1, 0, { type: "leaf", id: newId });
			const newFr = [...fr];
			newFr[idx] = half;
			newFr.splice(idx + 1, 0, half);
			return { ...node, children, fractions: normalizeFractions(newFr, children.length) };
		}
		// Perpendicular → wrap focus in a nested split of the requested orientation.
		children[idx] = {
			type: "split",
			dir,
			children: [node.children[idx], { type: "leaf", id: newId }],
			fractions: [0.5, 0.5],
		};
		return { ...node, children, fractions: normalizeFractions(node.fractions, children.length) };
	}
	for (let i = 0; i < node.children.length; i++) {
		const child = node.children[i];
		if (child.type === "split") {
			const res = insertNear(child, focusId, newId, dir);
			if (res) {
				const children = [...node.children];
				children[i] = res;
				return { ...node, children };
			}
		}
	}
	return null;
}

/**
 * Insert window `newId` adjacent to `focusId` with orientation `dir`. When focus
 * is absent (null/unknown) or the tree is empty, the window is appended to the
 * root (wrapping when needed). Returns a new tree.
 */
export function insert(
	root: TileNode,
	focusId: string | null | undefined,
	newId: string,
	dir: SplitDir,
): TileNode {
	if (hasLeaf(root, newId)) return root;
	if (isEmpty(root)) return { type: "leaf", id: newId };
	if (root.type === "leaf") {
		return {
			type: "split",
			dir,
			children: [root, { type: "leaf", id: newId }],
			fractions: [0.5, 0.5],
		};
	}
	if (focusId != null) {
		const near = insertNear(root, focusId, newId, dir);
		if (near) return near;
	}
	return appendTo(root, { type: "leaf", id: newId }, dir);
}

/** Remove `id`, collapsing any split left with a single child (or none). */
export function remove(root: TileNode, id: string): TileNode {
	const walk = (node: TileNode): TileNode | null => {
		if (node.type === "leaf") return node.id === id ? null : node;
		const kept: TileNode[] = [];
		const keptFr: number[] = [];
		const fr = normalizeFractions(node.fractions, node.children.length);
		node.children.forEach((c, i) => {
			const r = walk(c);
			if (r) {
				kept.push(r);
				keptFr.push(fr[i]);
			}
		});
		if (kept.length === 0) return null;
		if (kept.length === 1) return kept[0]; // collapse singleton split
		return { ...node, children: kept, fractions: normalizeFractions(keptFr, kept.length) };
	};
	return walk(root) ?? emptyTree();
}

/**
 * Reconcile the tree so its windows are exactly `ids`: drop leaves no longer
 * present, and insert new ids (near `focusId`, else appended) with orientation
 * `dir`. Used to resync the tree with the board's actual top-level shapes.
 */
export function reconcile(
	root: TileNode,
	ids: readonly string[],
	focusId: string | null | undefined,
	dir: SplitDir,
): TileNode {
	let tree = root;
	const wanted = new Set(ids);
	for (const id of leafIds(tree)) {
		if (!wanted.has(id)) tree = remove(tree, id);
	}
	for (const id of ids) {
		if (!hasLeaf(tree, id)) {
			const anchor =
				focusId != null && hasLeaf(tree, focusId) ? focusId : (leafIds(tree).at(-1) ?? null);
			tree = insert(tree, anchor, id, dir);
		}
	}
	return tree;
}

// ── Path helpers (immutable navigation to a node) ──

/** Child-index path from the root to the `id` leaf, or null if absent. `[]`
 *  means the root itself IS that leaf. */
function findPath(node: TileNode, id: string, acc: number[] = []): number[] | null {
	if (node.type === "leaf") return node.id === id ? acc : null;
	for (let i = 0; i < node.children.length; i++) {
		const r = findPath(node.children[i], id, [...acc, i]);
		if (r) return r;
	}
	return null;
}

/** The node at `path`, or undefined if the path doesn't resolve. */
function getAt(root: TileNode, path: readonly number[]): TileNode | undefined {
	let node: TileNode = root;
	for (const i of path) {
		if (node.type !== "split" || i < 0 || i >= node.children.length) return undefined;
		node = node.children[i];
	}
	return node;
}

/** Return a copy of `root` with the node at `path` replaced by `replacement`. */
function setAt(root: TileNode, path: readonly number[], replacement: TileNode): TileNode {
	if (path.length === 0) return replacement;
	if (root.type !== "split") return root;
	const [head, ...rest] = path;
	if (head < 0 || head >= root.children.length) return root;
	const children = [...root.children];
	children[head] = setAt(children[head], rest, replacement);
	return { ...root, children };
}

// ── Geometric focus / move ──

/** Overlap length of two 1-D ranges (0 when disjoint). */
function rangeOverlap(a0: number, a1: number, b0: number, b1: number): number {
	return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

/**
 * The window geometrically adjacent to `focusId` in direction `dir`, chosen from
 * `placements` (the resolved layout). Geometry-based — so focus movement is robust
 * regardless of how the tree happens to be nested: pick the nearest window whose
 * centre lies in the requested half-plane AND that overlaps focus on the cross
 * axis (so an aligned neighbor wins over a diagonal one). Returns its id, or
 * undefined when there's nothing that way.
 */
export function neighbor(
	placements: readonly Placement[],
	focusId: string,
	dir: FocusDir,
): string | undefined {
	const focus = placements.find((p) => p.id === focusId);
	if (!focus) return undefined;
	const fcx = focus.x + focus.width / 2;
	const fcy = focus.y + focus.height / 2;
	const horizontal = dir === "left" || dir === "right";
	let best: Placement | undefined;
	let bestScore = Number.POSITIVE_INFINITY;
	for (const p of placements) {
		if (p.id === focusId) continue;
		const cx = p.x + p.width / 2;
		const cy = p.y + p.height / 2;
		if (dir === "left" && cx >= fcx - 1) continue;
		if (dir === "right" && cx <= fcx + 1) continue;
		if (dir === "up" && cy >= fcy - 1) continue;
		if (dir === "down" && cy <= fcy + 1) continue;
		const overlap = horizontal
			? rangeOverlap(focus.y, focus.y + focus.height, p.y, p.y + p.height)
			: rangeOverlap(focus.x, focus.x + focus.width, p.x, p.x + p.width);
		if (overlap <= 0) continue;
		const primary =
			dir === "left" ? fcx - cx : dir === "right" ? cx - fcx : dir === "up" ? fcy - cy : cy - fcy;
		// Nearer along the axis wins; a larger cross-axis overlap breaks ties.
		const score = primary - overlap * 1e-3;
		if (score < bestScore) {
			bestScore = score;
			best = p;
		}
	}
	return best?.id;
}

/** Swap two windows' positions in the tree (by id). No-op if either is absent or
 *  they're the same. Used to implement geometric "move" (swap with neighbor). */
export function swapLeaves(root: TileNode, a: string, b: string): TileNode {
	if (a === b || !hasLeaf(root, a) || !hasLeaf(root, b)) return root;
	const map = (node: TileNode): TileNode => {
		if (node.type === "leaf") {
			if (node.id === a) return { type: "leaf", id: b };
			if (node.id === b) return { type: "leaf", id: a };
			return node;
		}
		return { ...node, children: node.children.map(map) };
	};
	return map(root);
}

// ── Resize / re-split (structural edits on the focus's parent split) ──

/**
 * Grow (`delta > 0`) or shrink (`delta < 0`) the focused window along its parent
 * split's axis, trading the fraction with an adjacent sibling. Both keep a small
 * minimum share. No-op when focus has no split parent (a lone root window).
 */
export function resize(root: TileNode, id: string, delta: number): TileNode {
	const path = findPath(root, id);
	if (!path || path.length === 0) return root;
	const parentPath = path.slice(0, -1);
	const idx = path[path.length - 1];
	const parent = getAt(root, parentPath);
	if (parent?.type !== "split" || parent.children.length < 2) return root;
	const fr = normalizeFractions(parent.fractions, parent.children.length);
	// Trade with the next sibling; if focus is last, trade with the previous — so
	// "grow" always enlarges focus regardless of its position.
	const nb = idx < fr.length - 1 ? idx + 1 : idx - 1;
	const MIN = 0.05;
	const d = Math.max(-(fr[idx] - MIN), Math.min(delta, fr[nb] - MIN));
	if (Math.abs(d) < 1e-9) return root;
	const newFr = [...fr];
	newFr[idx] += d;
	newFr[nb] -= d;
	return setAt(root, parentPath, { ...parent, fractions: newFr });
}

/** Set the orientation of the focused window's parent split (re-splits the row/
 *  column the window lives in). No-op for a lone root window. */
export function setDir(root: TileNode, id: string, dir: SplitDir): TileNode {
	const path = findPath(root, id);
	if (!path || path.length === 0) return root;
	const parent = getAt(root, path.slice(0, -1));
	if (parent?.type !== "split" || parent.dir === dir) return root;
	return setAt(root, path.slice(0, -1), { ...parent, dir });
}

/** Flip the orientation of the focused window's parent split. */
export function toggleDir(root: TileNode, id: string): TileNode {
	const path = findPath(root, id);
	if (!path || path.length === 0) return root;
	const parent = getAt(root, path.slice(0, -1));
	if (parent?.type !== "split") return root;
	return setAt(root, path.slice(0, -1), { ...parent, dir: parent.dir === "h" ? "v" : "h" });
}
