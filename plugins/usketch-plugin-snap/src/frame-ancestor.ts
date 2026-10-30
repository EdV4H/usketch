import type { BoardStore, ShapeRegistry } from "@edv4h/usketch-shared";
import { hasSelectableChildren } from "@edv4h/usketch-shared";

/**
 * Walk up the parentId chain to find the nearest frame-like ancestor: a
 * container whose children stay individually selectable (`frame`, the voice
 * frame, …), decided by the shape's `container` declaration via
 * {@link hasSelectableChildren} rather than a hardcoded `type === "frame"`.
 * Group-style containers are walked through, so shapes inside a group inside
 * a frame resolve to the frame. Returns null if there is none (top-level).
 */
export function getNearestFrameAncestor(
	store: Pick<BoardStore, "getShape">,
	shapes: Pick<ShapeRegistry, "get">,
	shapeId: string,
): string | null {
	let currentId = shapeId;
	const visited = new Set<string>();
	for (;;) {
		const shape = store.getShape(currentId);
		if (!shape) return null;
		const pid = shape.parentId as string | undefined;
		if (!pid) return null;
		if (visited.has(pid)) return null; // circular reference guard
		visited.add(pid);
		const parent = store.getShape(pid);
		if (!parent) return null;
		if (hasSelectableChildren(shapes.get(parent.type), parent)) return pid;
		currentId = pid;
	}
}
