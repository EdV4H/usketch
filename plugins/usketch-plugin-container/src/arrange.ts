import type { CanvasPointerEvent, PluginContext } from "@edv4h/usketch-shared";
import { getContainerLayout, isShapeContainer } from "@edv4h/usketch-shared";
import { getChildShapes } from "@edv4h/usketch-store";

/**
 * Keep a container's children arranged per its `container.layout`.
 *
 * Layout runs after a container's children/geometry settle — on pointer up
 * (covers drag-move, resize, and deferred auto-attach), on shape add, and on
 * non-drag (programmatic / MCP) updates. It intentionally does NOT run on every
 * intermediate `shape:updated` during a pointer drag: the select tool already
 * moves children with the container (native descendant follow), so re-laying
 * out mid-drag would fight that and cause jitter.
 *
 * Containers without a `layout` are ignored entirely (free positioning).
 *
 * Returns a teardown function.
 */
export function setupArrange(ctx: PluginContext): () => void {
	// Guard so the layout's own `updateShape` calls don't re-trigger arrange.
	let applying = false;
	let pointerDown = false;
	// Containers touched during the current pointer drag, re-laid out on pointer
	// up. Scoped to what actually changed so pointer-up work is O(touched), not
	// O(all shapes on the board).
	const dirty = new Set<string>();

	function hasLayout(type: string): boolean {
		return getContainerLayout(ctx.shapes.get(type)) !== undefined;
	}

	function layoutContainer(containerId: string): void {
		const container = ctx.store.getShape(containerId);
		if (!container) return;
		const def = ctx.shapes.get(container.type);
		if (!isShapeContainer(def, container)) return;
		const layout = getContainerLayout(def);
		if (!layout) return;
		const children = getChildShapes(ctx.store, containerId);
		if (children.length === 0) return;

		const patches = layout({ container, children });
		applying = true;
		try {
			for (const { id, patch } of patches) ctx.store.updateShape(id, patch);
		} finally {
			applying = false;
		}
	}

	// Record the layout-container(s) a change to `shapeId` could affect: the
	// shape itself (container moved/resized) and its parent (child added/moved).
	function markDirty(shapeId: string): void {
		const shape = ctx.store.getShape(shapeId);
		if (!shape) return;
		if (hasLayout(shape.type)) dirty.add(shapeId);
		if (typeof shape.parentId === "string") {
			const parent = ctx.store.getShape(shape.parentId);
			if (parent && hasLayout(parent.type)) dirty.add(shape.parentId);
		}
	}

	const offMutation = ctx.store.onMutation((event) => {
		if (applying) return; // ignore self-induced updates
		const payload = event.payload as { id?: string } | undefined;
		const id = payload?.id;
		if (!id) return;

		if (pointerDown) {
			// Mid-drag: don't fight native follow — just remember what to re-arrange
			// on pointer up.
			if (event.type === "shape:updated" || event.type === "shape:added") markDirty(id);
			return;
		}

		// Not dragging: apply immediately (programmatic / MCP / undo / deferred attach).
		if (event.type === "shape:added") {
			const parentId = ctx.store.getShape(id)?.parentId;
			if (typeof parentId === "string") layoutContainer(parentId);
			return;
		}
		if (event.type === "shape:updated") {
			const shape = ctx.store.getShape(id);
			if (!shape) return;
			// Container geometry changed → re-layout its children.
			if (isShapeContainer(ctx.shapes.get(shape.type), shape)) layoutContainer(id);
			// Child attached/edited under a container → re-layout that container.
			if (typeof shape.parentId === "string") layoutContainer(shape.parentId);
		}
	});

	const offDown = ctx.events.on<CanvasPointerEvent>("canvas:pointerdown", () => {
		pointerDown = true;
	});
	const offUp = ctx.events.on<CanvasPointerEvent>("canvas:pointerup", () => {
		pointerDown = false;
		// Re-layout the containers touched during the drag. Deferred so it runs
		// after the containment attacher's own deferred reparent (also on pointer
		// up); the attach's later `shape:updated` re-layouts the new parent too.
		setTimeout(() => {
			// If another drag started before this fired, defer again: laying out
			// mid-drag would fight native descendant-follow. Keep `dirty` intact.
			if (pointerDown) return;
			const ids = [...dirty];
			dirty.clear();
			for (const containerId of ids) layoutContainer(containerId);
		}, 0);
	});

	return () => {
		offMutation();
		offDown();
		offUp();
	};
}
