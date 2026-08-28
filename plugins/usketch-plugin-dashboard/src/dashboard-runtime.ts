// The reorder runtime: the inverse of the container plugin's `setupArrange`.
// `setupArrange` deliberately AVOIDS laying out during a drag (it would fight the
// select tool's native descendant-follow). The dashboard WANTS live reflow while
// dragging — so it does the opposite, made safe by one rule: never reposition the
// shape under the pointer. Siblings reflow around it (rAF-throttled); the dragged
// shape stays put until drop, when the whole board is committed in a single
// undoable command.
import type { BoardStore, PluginContext, ShapeData } from "@edv4h/usketch-shared";
import { createBatchUpdateShapesCommand } from "@edv4h/usketch-store";
import { getDashboardConfig, gridSpecFromConfig } from "./config-ops.js";
import type { GridSpec } from "./grid.js";
import { indexFromPoint, packGrid, packGridWithGap } from "./grid.js";
import { dashboardItems, isDashboardItem } from "./items.js";
import { readingOrder } from "./order.js";

/** rAF with a timeout fallback for SSR/tests/sandbox (no rAF available). */
const scheduleFrame: (cb: () => void) => number =
	typeof globalThis.requestAnimationFrame === "function"
		? (cb) => globalThis.requestAnimationFrame(cb)
		: (cb) => globalThis.setTimeout(cb, 16) as unknown as number;
const cancelFrame: (handle: number) => void =
	typeof globalThis.cancelAnimationFrame === "function"
		? (handle) => globalThis.cancelAnimationFrame(handle)
		: (handle) => globalThis.clearTimeout(handle);

/** Centre of a shape's box. Rotation is about the centre, so the centre is the
 *  same whether or not the shape is rotated — no AABB expansion needed. */
function centerOf(shape: ShapeData): { x: number; y: number } {
	return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
}

/** Resolve the board's grid spec, or null when this board isn't a dashboard. */
function specOf(store: BoardStore): GridSpec | null {
	const config = getDashboardConfig(store);
	return config ? gridSpecFromConfig(config) : null;
}

/**
 * Snap every item to its reading-order cell, in ONE undoable command. Used for
 * non-drag changes (programmatic add/remove) and the "整列 (Arrange)" action /
 * service `repack()`. No-op writes (already on their cell) are dropped so undo
 * history stays clean and this is safe to call speculatively.
 */
export function repackBoard(ctx: PluginContext): void {
	const spec = specOf(ctx.store);
	if (!spec) return;
	const items = dashboardItems(ctx.store);
	if (items.length === 0) return;
	const order = readingOrder(items, spec);
	const placements = packGrid(order, spec);

	const updates: Array<{ id: string; from: Partial<ShapeData>; to: Partial<ShapeData> }> = [];
	for (const p of placements) {
		const cur = ctx.store.getShape(p.id);
		if (!cur) continue;
		if (cur.x === p.x && cur.y === p.y) continue;
		updates.push({ id: p.id, from: { x: cur.x, y: cur.y }, to: { x: p.x, y: p.y } });
	}
	if (updates.length === 0) return;
	ctx.commands.execute(createBatchUpdateShapesCommand(ctx.store, updates));
}

/**
 * Wire the live-reflow runtime. Returns a teardown that removes every listener
 * and cancels any pending frame.
 */
export function setupDashboard(ctx: PluginContext): () => void {
	// Guard so our own layout writes don't re-enter onMutation.
	let applying = false;
	let pointerDown = false;
	// The shape currently under the pointer (never repositioned mid-drag).
	let draggingId: string | null = null;
	// Live insertion index derived from the dragged item's centre.
	let pendingTargetIndex = 0;
	let frame: number | null = null;
	// Pre-drag positions of every item, captured once per drag, so the drop
	// commits `from` = true pre-drag layout (a single clean undo).
	const dragBefore = new Map<string, { x: number; y: number }>();

	// Ids currently treated as top-level grid items. `shape:removed` carries no
	// shape (it's gone), so this lets us tell "an item was removed → reflow to
	// close the gap" from "a nested child was removed → leave the grid alone".
	// Seeded from a read-only scan after hydration and kept in sync on
	// add/remove and on non-drag updates (lock/hide/reparent flip membership).
	const itemIds = new Set<string>();
	let itemsSeeded = false;
	function seedItemIds(): void {
		itemIds.clear();
		for (const s of dashboardItems(ctx.store)) itemIds.add(s.id);
		itemsSeeded = true;
	}
	function refreshItemMembership(id: string): void {
		const shape = ctx.store.getShape(id);
		if (shape && isDashboardItem(ctx.store, shape)) itemIds.add(id);
		else itemIds.delete(id);
	}

	function withApplying(fn: () => void): void {
		applying = true;
		try {
			fn();
		} finally {
			applying = false;
		}
	}

	// Snapshot pre-drag positions the first time we notice a drag. Siblings are
	// still at rest here; the dragged shape's pre-drag position comes from the
	// mutation's `before` (it has already moved by the time we observe it).
	function captureBefore(draggedBefore: ShapeData): void {
		if (dragBefore.size > 0) return;
		for (const s of dashboardItems(ctx.store)) {
			dragBefore.set(s.id, { x: s.x, y: s.y });
		}
		dragBefore.set(draggedBefore.id, { x: draggedBefore.x, y: draggedBefore.y });
	}

	function reflowDuringDrag(): void {
		frame = null;
		if (!pointerDown || draggingId === null) return;
		const spec = specOf(ctx.store);
		if (!spec) return;
		const items = dashboardItems(ctx.store);
		const order = readingOrder(items, spec);
		const placements = packGridWithGap(order, draggingId, pendingTargetIndex, spec);
		withApplying(() => {
			for (const p of placements) {
				const cur = ctx.store.getShape(p.id);
				if (!cur || (cur.x === p.x && cur.y === p.y)) continue;
				ctx.store.updateShape(p.id, { x: p.x, y: p.y });
			}
		});
	}

	function scheduleReflow(): void {
		if (frame !== null) return; // coalesce to one write per frame
		frame = scheduleFrame(reflowDuringDrag);
	}

	function endDrag(): void {
		if (frame !== null) {
			cancelFrame(frame);
			frame = null;
		}
		const spec = specOf(ctx.store);
		const dragged = draggingId;
		// Reset live state before committing so our own command's mutations (seen
		// via onMutation) are treated as non-drag.
		draggingId = null;
		pointerDown = false;
		const before = new Map(dragBefore);
		dragBefore.clear();

		if (!spec) return;
		if (dragged === null) {
			// A drop we didn't track as a single-item reorder (a multi-select drag, or
			// a plain click). Re-snap every item to the grid so free-moved shapes
			// settle back onto cells (a no-op when nothing actually moved).
			repackBoard(ctx);
			return;
		}
		// Final order = siblings in reading order with the dragged item spliced in
		// at its target slot.
		const items = dashboardItems(ctx.store);
		const order = readingOrder(items, spec).filter((id) => id !== dragged);
		const clamped = Math.max(0, Math.min(Math.round(pendingTargetIndex), order.length));
		order.splice(clamped, 0, dragged);
		const placements = packGrid(order, spec);

		const updates: Array<{ id: string; from: Partial<ShapeData>; to: Partial<ShapeData> }> = [];
		for (const p of placements) {
			const cur = ctx.store.getShape(p.id);
			if (!cur) continue;
			const from = before.get(p.id) ?? { x: cur.x, y: cur.y };
			if (from.x === p.x && from.y === p.y) continue;
			updates.push({ id: p.id, from: { x: from.x, y: from.y }, to: { x: p.x, y: p.y } });
		}
		if (updates.length === 0) return;
		ctx.commands.execute(createBatchUpdateShapesCommand(ctx.store, updates));
	}

	const offMutation = ctx.store.onMutation((event) => {
		if (applying) return; // ignore self-induced writes

		if (event.type === "shape:updated") {
			// Keep item membership fresh: a non-drag update may lock/hide/reparent a
			// shape, flipping whether it's a grid item (used by shape:removed below).
			if (!pointerDown) {
				const updatedId = event.payload.after?.id;
				if (updatedId) refreshItemMembership(updatedId);
				return; // non-drag edits otherwise handled by add/remove + actions
			}
			const spec = specOf(ctx.store);
			if (!spec) return;
			const after = event.payload.after;
			const before = event.payload.before;
			if (!after || !isDashboardItem(ctx.store, after)) return;
			// Sortable reflow is a SINGLE-item interaction. With a multi-selection
			// drag, every selected shape's `shape:updated` would match below and
			// `draggingId` would flip between them each frame → jitter / bogus
			// reorder. Restrict live reflow to a single selected shape; multi-select
			// drags fall through and are re-snapped to the grid on drop (see endDrag).
			const selection = ctx.store.getSelection();
			if (selection.size !== 1 || !selection.has(after.id)) return;
			// …and only when the position actually moved — this rejects the other
			// false positive that fires `shape:updated` while the pointer is down:
			// remote collaborators' edits arriving via sync, and style-only updates.
			if (before && before.x === after.x && before.y === after.y) return;
			captureBefore(before);
			draggingId = after.id;
			const count = dashboardItems(ctx.store).length;
			pendingTargetIndex = indexFromPoint(centerOf(after), spec, count);
			scheduleReflow();
			return;
		}

		if (event.type === "shape:added" || event.type === "shape:removed") {
			if (pointerDown) return; // mid-drag churn settles on drop
			const id = event.payload.id;
			if (event.type === "shape:added") {
				const s = ctx.store.getShape(id);
				if (!s || !isDashboardItem(ctx.store, s)) return; // nested/substrate → ignore
				itemIds.add(id);
				repackBoard(ctx);
				return;
			}
			// shape:removed — repack (to close the gap) only when a tracked top-level
			// item was removed. A nested child's removal must NOT reflow the grid.
			// Before the seed lands, fall back to repacking (a safe no-op when the
			// grid is already packed).
			const wasItem = itemIds.delete(id);
			if (wasItem || !itemsSeeded) repackBoard(ctx);
		}
	});

	const offDown = ctx.events.on("canvas:pointerdown", () => {
		pointerDown = true;
		draggingId = null;
		dragBefore.clear();
	});
	// Prefer `shapes:move-end` (fires after the select tool commits its move) so
	// our commit lands after it; fall back to raw pointerup if a drag produced no
	// move-end (e.g. a click that didn't move anything).
	const offMoveEnd = ctx.events.on<{ shapeIds: string[] }>("shapes:move-end", () => {
		if (pointerDown) endDrag();
	});
	// Fallback for a pointerup that produced no `shapes:move-end` (a click, or a
	// tool that doesn't emit it). Deferred to a macrotask so a move-end microtask
	// from the same gesture always commits first; `endDrag` is idempotent, so a
	// double fire is harmless.
	const offUp = ctx.events.on("canvas:pointerup", () => {
		globalThis.setTimeout(() => {
			if (pointerDown) endDrag();
		}, 0);
	});

	// Seed the item set once shapes are present. Deferred so shapes hydrated
	// synchronously on load are visible; read-only, so it's harmless if it runs
	// after teardown (the mutation listener is already removed by then).
	queueMicrotask(seedItemIds);

	return () => {
		offMutation();
		offDown();
		offMoveEnd();
		offUp();
		if (frame !== null) cancelFrame(frame);
	};
}
