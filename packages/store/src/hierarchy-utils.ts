import {
	type BoardStore,
	type BoundingBox,
	isShapeHidden,
	isShapeLocked,
	type ShapeData,
} from "@edv4h/usketch-shared";

/** Get all direct children of a parent shape */
export function getChildShapes(store: BoardStore, parentId: string): ShapeData[] {
	const children: ShapeData[] = [];
	for (const [, shape] of store.getShapes()) {
		if (shape.parentId === parentId) {
			children.push(shape);
		}
	}
	return children;
}

/** Get the parent shape of a child */
export function getParentShape(store: BoardStore, childId: string): ShapeData | undefined {
	const child = store.getShape(childId);
	if (!child || typeof child.parentId !== "string") return undefined;
	return store.getShape(child.parentId);
}

/** Get the full ancestor chain from child to root (root first) */
export function getAncestorChain(store: BoardStore, childId: string): ShapeData[] {
	const chain: ShapeData[] = [];
	let currentId = childId;
	const visited = new Set<string>();
	for (;;) {
		const shape = store.getShape(currentId);
		if (!shape || typeof shape.parentId !== "string") break;
		if (visited.has(shape.parentId)) break; // circular reference guard
		visited.add(shape.parentId);
		const parent = store.getShape(shape.parentId);
		if (!parent) break;
		chain.unshift(parent);
		currentId = parent.id;
	}
	return chain;
}

/** Get the top-level ancestor (group or frame) for a shape, or the shape itself if it has no parent */
export function getTopLevelAncestor(store: BoardStore, shapeId: string): ShapeData | undefined {
	const chain = getAncestorChain(store, shapeId);
	if (chain.length > 0) return chain[0];
	return store.getShape(shapeId);
}

/** Get all shapes that have no parentId (top-level shapes) */
export function getTopLevelShapes(store: BoardStore): ShapeData[] {
	const result: ShapeData[] = [];
	for (const [, shape] of store.getShapes()) {
		if (shape.parentId === undefined || shape.parentId === null) {
			result.push(shape);
		}
	}
	return result;
}

/** Compute the bounding box that encloses all given shapes */
export function computeGroupBounds(children: ShapeData[]): BoundingBox {
	if (children.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	for (const child of children) {
		minX = Math.min(minX, child.x);
		minY = Math.min(minY, child.y);
		maxX = Math.max(maxX, child.x + child.width);
		maxY = Math.max(maxY, child.y + child.height);
	}

	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Whether a shape is effectively hidden: its own `hidden` flag OR any ancestor's.
 * Cascade mirrors Figma — hiding a group/frame hides its subtree. Cycle-safe via
 * {@link getAncestorChain}.
 */
export function isEffectivelyHidden(store: BoardStore, shape: ShapeData): boolean {
	if (isShapeHidden(shape)) return true;
	// Short-circuit top-level shapes (the common case) before the ancestor walk,
	// which allocates — this runs per candidate in hot pointer/marquee paths.
	if (typeof shape.parentId !== "string") return false;
	return getAncestorChain(store, shape.id).some(isShapeHidden);
}

/**
 * Whether a shape is effectively locked: its own `locked` flag OR any ancestor's.
 * Cascade mirrors Figma — locking a group/frame locks its subtree.
 */
export function isEffectivelyLocked(store: BoardStore, shape: ShapeData): boolean {
	if (isShapeLocked(shape)) return true;
	if (typeof shape.parentId !== "string") return false;
	return getAncestorChain(store, shape.id).some(isShapeLocked);
}

/** Check if reparenting would create a cycle */
export function wouldCreateCycle(store: BoardStore, shapeId: string, newParentId: string): boolean {
	if (shapeId === newParentId) return true;
	const ancestors = getAncestorChain(store, newParentId);
	return ancestors.some((a) => a.id === shapeId);
}
