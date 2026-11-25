import type { CanvasPointerEvent, PluginContext, ShapeData } from "@edv4h/usketch-shared";
import { getContainerLayout, isShapeContainer } from "@edv4h/usketch-shared";
import { getChildShapes } from "@edv4h/usketch-store";

/**
 * Keep a container's children arranged per its `container.layout`.
 *
 * Layout runs after a container's children/geometry settle — after pointer up
 * (covers drag-move, resize, and deferred auto-attach), on shape add, and on
 * non-drag (programmatic / MCP) updates. It intentionally does NOT run on every
 * intermediate `shape:updated` during a pointer drag: the select tool already
 * moves children with the container (native descendant follow), so re-laying
 * out mid-drag would fight that and cause jitter.
 *
 * A drop settles a little after pointer up: the select tool commits its move
 * command in a microtask and then emits `shapes:move-end`, and the containment
 * attacher reparents on a timer after that. Until then a dragged child still
 * has its old parent, so laying that parent out would pull the child back in
 * (a child dragged out of a laid-out container could never leave it). Updates in
 * that window are only recorded, and the re-layout waits for the reparents.
 *
 * Containers without a `layout` are ignored entirely (free positioning).
 *
 * Returns a teardown function.
 */
export function setupArrange(ctx: PluginContext): () => void {
	// Guard so the layout's own `updateShape` calls don't re-trigger arrange.
	let applying = false;
	let pointerDown = false;
	// From pointer up until the deferred flush: the drop is still settling (move
	// command, move-end, reparent), so updates are recorded rather than applied.
	let settling = false;
	// A move-end arrived while settling: the flush waits for its reparent.
	let moveEnded = false;
	// Handle for the deferred pointer-up flush, so it can be cancelled when a new
	// drag starts or the plugin is torn down.
	let flushTimer: ReturnType<typeof setTimeout> | null = null;
	// Containers touched during the current pointer drag, re-laid out on pointer
	// up. Scoped to what actually changed so pointer-up work is O(touched), not
	// O(all shapes on the board).
	const dirty = new Set<string>();

	// A shape is a layout container only if this *instance* is an enabled
	// container (honoring per-instance `container.enabled`) and defines a layout.
	function isLayoutContainer(shape: ShapeData): boolean {
		const def = ctx.shapes.get(shape.type);
		return isShapeContainer(def, shape) && getContainerLayout(def) !== undefined;
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
		if (isLayoutContainer(shape)) dirty.add(shapeId);
		if (typeof shape.parentId === "string") {
			const parent = ctx.store.getShape(shape.parentId);
			if (parent && isLayoutContainer(parent)) dirty.add(shape.parentId);
		}
	}

	const offMutation = ctx.store.onMutation((event) => {
		if (applying) return; // ignore self-induced updates
		const payload = event.payload as { id?: string } | undefined;
		const id = payload?.id;
		if (!id) return;

		if (pointerDown) {
			// Mid-drag: don't fight native follow — just remember what to re-arrange
			// once the drop settles.
			if (event.type === "shape:updated" || event.type === "shape:added") markDirty(id);
			return;
		}
		if (settling) {
			// The drop is still settling: record what the immediate path below would
			// lay out, and lay it out once the reparent is done.
			if (event.type === "shape:added") {
				const parentId = ctx.store.getShape(id)?.parentId;
				if (typeof parentId === "string") dirty.add(parentId);
			} else if (event.type === "shape:updated") {
				markDirty(id);
			}
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
		// Cancel a previous drag's pending flush so it can't run mid-drag.
		if (flushTimer !== null) {
			clearTimeout(flushTimer);
			flushTimer = null;
		}
	});

	function flush(): void {
		flushTimer = null;
		// If another drag started before this fired, defer again: laying out
		// mid-drag would fight native descendant-follow. Keep `dirty` intact.
		if (pointerDown) return;
		settling = false;
		moveEnded = false;
		const ids = [...dirty];
		dirty.clear();
		for (const containerId of ids) layoutContainer(containerId);
	}

	function scheduleFlush(): void {
		if (flushTimer !== null) clearTimeout(flushTimer);
		flushTimer = setTimeout(flush, 0);
	}

	const offUp = ctx.events.on<CanvasPointerEvent>("canvas:pointerup", () => {
		pointerDown = false;
		settling = true;
		moveEnded = false;
		// Re-layout the containers touched during the drag, once the drop settles.
		// Deferred so the select tool's move command (a microtask) is recorded too.
		scheduleFlush();
	});

	// The select tool emits move-end after committing a move, and the attachers
	// (containment, attachable) reparent on timers queued by their own move-end
	// listeners. Re-queue the flush one timer later, so it runs after every one of
	// those whatever order they were registered in, and lays out the containers
	// the shapes are in after the drop, not before it.
	const offMoveEnd = ctx.events.on("shapes:move-end", () => {
		if (!settling || moveEnded) return;
		moveEnded = true;
		if (flushTimer !== null) clearTimeout(flushTimer);
		flushTimer = setTimeout(() => {
			flushTimer = setTimeout(flush, 0);
		}, 0);
	});

	return () => {
		offMutation();
		offDown();
		offUp();
		offMoveEnd();
		if (flushTimer !== null) clearTimeout(flushTimer);
	};
}
