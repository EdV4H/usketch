// The reorder runtime. It reflows the grid while an item is dragged and snaps
// everything on drop. Unlike the container plugin's `setupArrange` (which avoids
// laying out during a drag), the dashboard WANTS live reflow — made safe by one
// rule: never reposition the shape under the pointer while dragging.
//
// It is driven by the SEMANTIC events that actually fire during a shape drag —
// `shape:updated` (the select tool writes the dragged shape's position live) and
// `shapes:move-end` (emitted on drop) — NOT `canvas:pointerdown/up`, which don't
// reliably reach here when the interaction is on a shape. To tell its OWN writes
// (reflow / repack / commit / undo) apart from genuine user drags, every
// dashboard-initiated position write bumps a re-entrancy guard; the mutation
// listener ignores anything written while that guard is up.
import type { BoardStore, Command, PluginContext, ShapeData } from "@edv4h/usketch-shared";
import {
	fitToGridOf,
	freeOutOfRangeOf,
	getDashboardConfig,
	gridSpecFromConfig,
	modeOf,
} from "./config-ops.js";
import { setDragTarget } from "./drag-target-store.js";
import type { GridSpec, ItemSize, PlacedBox, Placement } from "./grid.js";
import {
	cellOfPoint,
	cellXY,
	fitSize,
	packAbsolute,
	packSpans,
	spanOf,
	targetIndexFromPoint,
} from "./grid.js";
import { allDashboardItems, dashboardItems, isGridItem, isWithinGrid } from "./items.js";
import { readingOrder } from "./order.js";

// ── Self-write guard (module-scoped; one app instance per JS runtime) ──
let dashboardWrites = 0;
/** Run `fn` with the dashboard-write guard raised so the reflow runtime ignores
 *  the store mutations it produces. Exported so the service can guard its own
 *  config command's execute/undo the same way. */
export function runGuarded(fn: () => void): void {
	dashboardWrites++;
	try {
		fn();
	} finally {
		dashboardWrites--;
	}
}

type Move = { id: string; from: { x: number; y: number }; to: { x: number; y: number } };

/** A batch move command whose execute AND undo are guarded — so neither applying
 *  nor undoing it is mistaken for a user drag. */
function guardedBatchCommand(store: BoardStore, moves: readonly Move[]): Command {
	return {
		execute() {
			runGuarded(() => {
				for (const m of moves) store.updateShape(m.id, m.to);
			});
		},
		undo() {
			runGuarded(() => {
				for (const m of moves) store.updateShape(m.id, m.from);
			});
		},
	};
}

/** rAF with a timeout fallback for SSR/tests/sandbox (no rAF available). */
const scheduleFrame: (cb: () => void) => number =
	typeof globalThis.requestAnimationFrame === "function"
		? (cb) => globalThis.requestAnimationFrame(cb)
		: (cb) => globalThis.setTimeout(cb, 16) as unknown as number;
const cancelFrame: (handle: number) => void =
	typeof globalThis.cancelAnimationFrame === "function"
		? (handle) => globalThis.cancelAnimationFrame(handle)
		: (handle) => globalThis.clearTimeout(handle);

/** Centre of a shape's box (rotation is about the centre, so it's rotation-invariant). */
function centerOf(shape: ShapeData): { x: number; y: number } {
	return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
}

/** Resolve the board's grid spec, or null when this board isn't a dashboard. */
function specOf(store: BoardStore): GridSpec | null {
	const config = getDashboardConfig(store);
	return config ? gridSpecFromConfig(config) : null;
}

/** (id → width/height) for a list of ids in order, skipping any gone. */
function sizedOrder(store: BoardStore, ids: readonly string[]): ItemSize[] {
	const out: ItemSize[] = [];
	for (const id of ids) {
		const s = store.getShape(id);
		if (s) out.push({ id, width: s.width, height: s.height });
	}
	return out;
}

/** A single shape as a placement box. */
function boxOfShape(s: ShapeData): PlacedBox {
	return { id: s.id, x: s.x, y: s.y, width: s.width, height: s.height };
}

/** (id → position + size) boxes for a list of ids in order (for absolute packing). */
function boxesOf(store: BoardStore, ids: readonly string[]): PlacedBox[] {
	const out: PlacedBox[] = [];
	for (const id of ids) {
		const s = store.getShape(id);
		if (s) out.push({ id, x: s.x, y: s.y, width: s.width, height: s.height });
	}
	return out;
}

/** Compact placed footprints for `ids` (span-packed) — a stable reference for the
 *  drop-index (independent of any live gap already opened). */
function placedBoxes(store: BoardStore, ids: readonly string[], spec: GridSpec): PlacedBox[] {
	const sizes = sizedOrder(store, ids);
	const compact = packSpans(sizes, spec);
	return compact.map((p, i) => ({
		id: p.id,
		x: p.x,
		y: p.y,
		width: sizes[i].width,
		height: sizes[i].height,
	}));
}

/**
 * Snap every item to its reading-order cell, span-aware, in ONE guarded+undoable
 * command. Used for non-drag changes (add/remove) and the "整列" action / service
 * `repack()`. No-op writes are dropped, so it's safe to call speculatively.
 */
export function repackBoard(ctx: PluginContext, includeAll = false): void {
	const spec = specOf(ctx.store);
	if (!spec) return;
	// `includeAll` (enable / 整列) gathers every shape into the grid; the default
	// respects the range so out-of-grid shapes stay free.
	const items = includeAll ? allDashboardItems(ctx.store) : dashboardItems(ctx.store);
	if (items.length === 0) return;
	const order = readingOrder(items, spec);
	// flow → compact in reading order; absolute → snap each to the cell nearest its
	// current position (gaps preserved), reading order breaking cell contention.
	const placements =
		modeOf(ctx.store) === "absolute"
			? packAbsolute(boxesOf(ctx.store, order), spec)
			: packSpans(sizedOrder(ctx.store, order), spec);

	const moves: Move[] = [];
	for (const p of placements) {
		const cur = ctx.store.getShape(p.id);
		if (!cur) continue;
		if (cur.x === p.x && cur.y === p.y) continue;
		moves.push({ id: p.id, from: { x: cur.x, y: cur.y }, to: { x: p.x, y: p.y } });
	}
	if (moves.length === 0) return;
	ctx.commands.execute(guardedBatchCommand(ctx.store, moves));
}

/**
 * Wire the live-reflow runtime. Returns a teardown that removes every listener
 * and cancels any pending frame.
 */
export function setupDashboard(ctx: PluginContext): () => void {
	// The shape currently under the pointer (never repositioned mid-drag), and its
	// latest centre (used to derive the live drop index).
	let draggingId: string | null = null;
	// The item being resized (fit-to-grid): snapped to a whole-cell size on settle.
	let resizingId: string | null = null;
	let pendingPoint: { x: number; y: number } = { x: 0, y: 0 };
	let frame: number | null = null;
	// Drop is committed when the drag's `shape:updated` stream goes quiet for this
	// long — a signal-independent end-of-drag detector, because the explicit drop
	// events (`shapes:move-end` / `canvas:pointerup`) don't reliably reach here for
	// a shape drag. `shapes:move-end`, when it does fire, commits sooner.
	const SETTLE_MS = 120;
	let settleTimer: ReturnType<typeof setTimeout> | null = null;
	function armSettle(): void {
		if (settleTimer !== null) clearTimeout(settleTimer);
		settleTimer = globalThis.setTimeout(() => {
			settleTimer = null;
			if (draggingId !== null) {
				endDrag();
			} else if (resizingId !== null) {
				// Resize settled: snap the size to whole cells + re-lay out, then clear.
				const id = resizingId;
				resizingId = null;
				setDragTarget(null);
				commitResizeToGrid(id);
			} else {
				repackBoard(ctx);
			}
		}, SETTLE_MS);
	}
	function clearSettle(): void {
		if (settleTimer !== null) {
			clearTimeout(settleTimer);
			settleTimer = null;
		}
	}
	// Pre-drag positions captured once per drag, so the drop commits `from` = true
	// pre-drag layout (a single clean undo).
	const dragBefore = new Map<string, { x: number; y: number }>();

	// Ids currently treated as top-level grid items — lets `shape:removed` (which
	// carries no shape) tell "an item was removed → reflow" from "a nested child
	// was removed → leave the grid alone". Seeded after hydration; kept in sync.
	const itemIds = new Set<string>();
	let itemsSeeded = false;
	function seedItemIds(): void {
		itemIds.clear();
		for (const s of dashboardItems(ctx.store)) itemIds.add(s.id);
		itemsSeeded = true;
	}
	function refreshItemMembership(id: string): void {
		const shape = ctx.store.getShape(id);
		if (shape && isGridItem(ctx.store, shape)) itemIds.add(id);
		else itemIds.delete(id);
	}

	// Snapshot pre-drag positions the first time we notice a drag. Siblings are at
	// rest here; the dragged shape's pre-drag position comes from the mutation's
	// `before` (it has already moved by the time we observe it).
	function captureBefore(draggedBefore: ShapeData): void {
		dragBefore.clear();
		for (const s of dashboardItems(ctx.store)) dragBefore.set(s.id, { x: s.x, y: s.y });
		dragBefore.set(draggedBefore.id, { x: draggedBefore.x, y: draggedBefore.y });
	}

	/** Highlight the cell a dragged item of `width×height` will land at `topLeft`. */
	function publishHighlight(
		spec: GridSpec,
		topLeft: { x: number; y: number },
		width: number,
		height: number,
	): void {
		const span = spanOf(width, height, spec);
		setDragTarget({
			x: topLeft.x,
			y: topLeft.y,
			width: span.cols * spec.cellW + (span.cols - 1) * spec.gap,
			height: span.rows * spec.cellH + (span.rows - 1) * spec.gap,
		});
	}

	/** During a resize, highlight the whole-cell footprint the item will snap to
	 *  (positioned at the cell nearest its current top-left). */
	function highlightResizeTarget(spec: GridSpec, shape: ShapeData): void {
		const fit = fitSize(shape.width, shape.height, spec);
		const span = spanOf(fit.width, fit.height, spec);
		const cols = Math.max(1, Math.floor(spec.columns));
		const cell = cellOfPoint(shape.x, shape.y, spec);
		const col = Math.min(Math.max(0, cell.col), Math.max(0, cols - span.cols));
		const tl = cellXY(col, Math.max(0, cell.row), spec);
		setDragTarget({ x: tl.x, y: tl.y, width: fit.width, height: fit.height });
	}

	/** Snap a resized item to whole-cell size and re-lay out the board, as one
	 *  undoable command. */
	function commitResizeToGrid(id: string): void {
		const spec = specOf(ctx.store);
		if (!spec) return;
		const shape = ctx.store.getShape(id);
		if (!shape) return;
		const fit = fitSize(shape.width, shape.height, spec);
		const items = dashboardItems(ctx.store);
		const shapes = readingOrder(items, spec)
			.map((iid) => ctx.store.getShape(iid))
			.filter((s): s is ShapeData => s !== undefined);
		const sizeFor = (s: ShapeData) =>
			s.id === id ? { width: fit.width, height: fit.height } : { width: s.width, height: s.height };
		const placements =
			modeOf(ctx.store) === "absolute"
				? packAbsolute(
						shapes.map((s) => ({ id: s.id, x: s.x, y: s.y, ...sizeFor(s) })),
						spec,
					)
				: packSpans(
						shapes.map((s) => ({ id: s.id, ...sizeFor(s) })),
						spec,
					);

		const oldSize = { width: shape.width, height: shape.height };
		const oldPos = new Map(items.map((s) => [s.id, { x: s.x, y: s.y }]));
		const willChange =
			fit.width !== shape.width ||
			fit.height !== shape.height ||
			placements.some((p) => {
				const s = ctx.store.getShape(p.id);
				return s !== undefined && (s.x !== p.x || s.y !== p.y);
			});
		if (!willChange) return;

		const command: Command = {
			execute() {
				runGuarded(() => {
					ctx.store.updateShape(id, fit);
					for (const p of placements) ctx.store.updateShape(p.id, { x: p.x, y: p.y });
				});
			},
			undo() {
				runGuarded(() => {
					ctx.store.updateShape(id, oldSize);
					for (const [iid, pos] of oldPos) ctx.store.updateShape(iid, pos);
				});
			},
		};
		ctx.commands.execute(command);
	}

	function reflowDuringDrag(): void {
		frame = null;
		const dragged = draggingId;
		if (dragged === null) return;
		const spec = specOf(ctx.store);
		if (!spec) return;
		const items = dashboardItems(ctx.store);
		if (!items.some((i) => i.id === dragged)) return;
		const draggedShape = ctx.store.getShape(dragged);
		if (!draggedShape) return;
		const otherIds = readingOrder(items, spec).filter((id) => id !== dragged);

		if (modeOf(ctx.store) === "absolute") {
			// Siblings stay put; just show where the dragged item snaps (nearest free
			// cell to where it floats). No writes.
			const boxes = [...boxesOf(ctx.store, otherIds), boxOfShape(draggedShape)];
			const dp = packAbsolute(boxes, spec).find((p) => p.id === dragged);
			if (dp) publishHighlight(spec, dp, draggedShape.width, draggedShape.height);
			return;
		}

		// flow: pack with the dragged item reserving its slot, then write everyone
		// EXCEPT the dragged shape — opening the gap it'll drop into.
		const target = targetIndexFromPoint(pendingPoint, placedBoxes(ctx.store, otherIds, spec), spec);
		const order = [...otherIds];
		order.splice(target, 0, dragged);
		const placements = packSpans(sizedOrder(ctx.store, order), spec);
		const dp = placements.find((p) => p.id === dragged);
		if (dp) publishHighlight(spec, dp, draggedShape.width, draggedShape.height);
		runGuarded(() => {
			for (const p of placements) {
				if (p.id === dragged) continue;
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

	/** Commit placements as one guarded+undoable command. `dragBefore` gives each
	 *  item's pre-drag position so undo restores the whole layout in one step. */
	function commitPlacements(placements: readonly Placement[]): void {
		const moves: Move[] = [];
		for (const p of placements) {
			const cur = ctx.store.getShape(p.id);
			if (!cur) continue;
			const from = dragBefore.get(p.id) ?? { x: cur.x, y: cur.y };
			// Skip only when there's genuinely nothing to do: the shape is already at
			// the target AND its pre-drag position was too (so undo needs no entry).
			// Comparing `from` alone would wrongly skip a shape whose pre-drag position
			// equals the target but which was dragged AWAY (its CURRENT position is the
			// drop point) — that's the item that must snap back.
			const atTarget = cur.x === p.x && cur.y === p.y;
			const fromTarget = from.x === p.x && from.y === p.y;
			if (atTarget && fromTarget) continue;
			moves.push({ id: p.id, from: { x: from.x, y: from.y }, to: { x: p.x, y: p.y } });
		}
		if (moves.length > 0) ctx.commands.execute(guardedBatchCommand(ctx.store, moves));
	}

	function endDrag(): void {
		clearSettle();
		setDragTarget(null); // clear the drop-target highlight
		resizingId = null;
		if (frame !== null) {
			cancelFrame(frame);
			frame = null;
		}
		const spec = specOf(ctx.store);
		const dragged = draggingId;
		draggingId = null;
		if (!spec) {
			dragBefore.clear();
			return;
		}
		const mode = modeOf(ctx.store);
		const items = dashboardItems(ctx.store);
		const order = readingOrder(items, spec);
		const draggedShape = dragged !== null ? ctx.store.getShape(dragged) : undefined;

		const draggedOutOfRange =
			draggedShape !== undefined &&
			freeOutOfRangeOf(ctx.store) &&
			!isWithinGrid(draggedShape, spec);
		if (dragged === null || !draggedShape || draggedOutOfRange) {
			// Untracked drop (multi-select / vanished), OR the dragged item was taken
			// OUT of the grid range → leave it free; just re-snap the remaining items
			// (which already excludes it) to close the gap.
			commitPlacements(
				mode === "absolute"
					? packAbsolute(boxesOf(ctx.store, order), spec)
					: packSpans(sizedOrder(ctx.store, order), spec),
			);
			dragBefore.clear();
			return;
		}

		const otherIds = order.filter((id) => id !== dragged);
		if (mode === "absolute") {
			// Dragged → cell nearest its dropped position; others keep their cells
			// (processed first so they win their own cells).
			const boxes = [...boxesOf(ctx.store, otherIds), boxOfShape(draggedShape)];
			commitPlacements(packAbsolute(boxes, spec));
		} else {
			// flow: insert the dragged item at the index its FINAL (dropped) centre
			// lands on (recomputed so revert/replay churn can't corrupt it), compact.
			const target = targetIndexFromPoint(
				centerOf(draggedShape),
				placedBoxes(ctx.store, otherIds, spec),
				spec,
			);
			otherIds.splice(target, 0, dragged);
			commitPlacements(packSpans(sizedOrder(ctx.store, otherIds), spec));
		}
		dragBefore.clear();
	}

	const offMutation = ctx.store.onMutation((event) => {
		if (dashboardWrites > 0) return; // ignore our own writes (reflow / commit / undo)

		if (event.type === "shape:updated") {
			const after = event.payload.after;
			const before = event.payload.before;
			if (after) refreshItemMembership(after.id);
			if (!after || !isGridItem(ctx.store, after)) return;
			const spec = specOf(ctx.store);
			if (!spec) return;
			// A user drag is a SINGLE selected item whose position actually changed.
			// This rejects multi-select drags (handled as a re-snap on drop), remote
			// collaborators' edits, and style-only updates.
			const selection = ctx.store.getSelection();
			if (selection.size !== 1 || !selection.has(after.id)) return;
			const sizeChanged = !before || before.width !== after.width || before.height !== after.height;
			if (sizeChanged) {
				// A RESIZE, not a reorder. Let it move at its ACTUAL size (no live
				// write); with "fit to grid" on, show the cell footprint it'll snap to
				// and apply the snap when the resize settles (like move → drop).
				if (fitToGridOf(ctx.store)) {
					resizingId = after.id;
					highlightResizeTarget(spec, after);
				}
				armSettle();
				return;
			}
			if (before && before.x === after.x && before.y === after.y) return;
			if (draggingId === null && before) captureBefore(before); // first frame → snapshot
			resizingId = null; // a move, not a resize
			draggingId = after.id;
			pendingPoint = centerOf(after);
			scheduleReflow();
			armSettle(); // commit shortly after the move stream goes quiet
			return;
		}

		if (event.type === "selection:changed") {
			// Safety net for a drag abandoned without a move-end (e.g. Escape): if the
			// tracked item is no longer the sole selection, finalize now.
			if (draggingId !== null) {
				const sel = ctx.store.getSelection();
				if (!(sel.size === 1 && sel.has(draggingId))) endDrag();
			}
			return;
		}

		if (event.type === "shape:added" || event.type === "shape:removed") {
			if (draggingId !== null) return; // mid-reorder churn settles on drop
			const id = event.payload.id;
			if (event.type === "shape:added") {
				const s = ctx.store.getShape(id);
				if (!s || !isGridItem(ctx.store, s)) return; // nested / substrate → ignore
				itemIds.add(id);
				repackBoard(ctx);
				return;
			}
			// shape:removed — reflow to close the gap only when a tracked top-level
			// item was removed. Before the seed lands, fall back to repacking.
			const wasItem = itemIds.delete(id);
			if (wasItem || !itemsSeeded) repackBoard(ctx);
		}
	});

	// Drop: the select tool emits `shapes:move-end` after committing its move, so
	// our snap lands last. This is the authoritative end-of-drag signal.
	const offMoveEnd = ctx.events.on<{ shapeIds: string[] }>("shapes:move-end", () => {
		endDrag();
	});

	// Seed the item set once shapes are present (read-only; harmless after teardown).
	queueMicrotask(seedItemIds);

	return () => {
		offMutation();
		offMoveEnd();
		clearSettle();
		if (frame !== null) cancelFrame(frame);
	};
}
