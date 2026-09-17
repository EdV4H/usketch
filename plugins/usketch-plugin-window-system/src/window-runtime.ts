// The tiling runtime. In TILE mode it keeps the board's windows laid out to the
// i3/sway tree that fills the fixed screen: it reconciles the tree with the actual
// top-level shapes on add/remove, resolves each window's rectangle, and writes the
// positions/sizes back — all as ONE undoable command (so an add + its retile revert
// cleanly). Like dashboard's runtime, every window-system write bumps a re-entrancy
// guard so the runtime never mistakes its OWN writes for a user drag.
import type { BoardStore, Command, PluginContext, ShapeData } from "@edv4h/usketch-shared";
import {
	defaultSplitOf,
	focusedIdOf,
	fullscreenIdOf,
	gapOf,
	getTree,
	getWindowConfig,
	modeOf,
	paddingOf,
	serializeTree,
	setConfig,
	viewportLockOf,
} from "./config-ops.js";
import { isWindow, windowIds, windows } from "./items.js";
import {
	insetRect,
	layoutTree,
	type Placement,
	type Rect,
	reconcile,
	type TileNode,
} from "./tile-tree.js";

// ── Self-write guard (module-scoped; one app instance per JS runtime) ──
let windowWrites = 0;
/** Run `fn` with the window-system write guard raised so the runtime ignores the
 *  store mutations it produces. Exported so the service can guard its own config
 *  command's execute/undo the same way. */
export function runGuarded(fn: () => void): void {
	windowWrites++;
	try {
		fn();
	} finally {
		windowWrites--;
	}
}

/** True while a window-system write is in flight — used by the viewport-lock
 *  listener to ignore our OWN config/position writes (only external edits, sync,
 *  and canvas resizes should re-pin + re-tile). */
export function isGuarded(): boolean {
	return windowWrites > 0;
}

/** rAF with a timeout fallback for SSR/tests/sandbox. */
const scheduleFrame: (cb: () => void) => number =
	typeof globalThis.requestAnimationFrame === "function"
		? (cb) => globalThis.requestAnimationFrame(cb)
		: (cb) => globalThis.setTimeout(cb, 16) as unknown as number;

/** One writable field-set per shape (position + size, or custom config fields like
 *  `tree`), for a guarded command. Config carries fields on top of ShapeData, which
 *  the store merges verbatim — so we type these loosely and cast at the write. */
interface GuardedWrite {
	id: string;
	before: Record<string, unknown>;
	after: Record<string, unknown>;
}

/** A batch write whose execute AND undo are guarded — so neither applying nor
 *  undoing it is mistaken for a user drag. */
function guardedCommand(store: BoardStore, writes: readonly GuardedWrite[]): Command {
	return {
		execute() {
			runGuarded(() => {
				for (const w of writes) store.updateShape(w.id, w.after as Partial<ShapeData>);
			});
		},
		undo() {
			runGuarded(() => {
				for (const w of writes) store.updateShape(w.id, w.before as Partial<ShapeData>);
			});
		},
	};
}

/** Measure the canvas area in CSS pixels, or null. Prefers the largest
 *  `canvas-container` (a minimap tags one too); falls back to the window. */
function canvasSize(): { width: number; height: number } | null {
	if (typeof document !== "undefined") {
		let best: { width: number; height: number } | null = null;
		for (const el of document.querySelectorAll('[data-testid="canvas-container"]')) {
			const r = el.getBoundingClientRect();
			if (r.width > 0 && r.height > 0 && (!best || r.width * r.height > best.width * best.height)) {
				best = { width: r.width, height: r.height };
			}
		}
		if (best) return best;
	}
	if (typeof window !== "undefined" && window.innerWidth > 0) {
		return { width: window.innerWidth, height: window.innerHeight };
	}
	return null;
}

/**
 * The fixed-screen world rectangle the tree fills. Under viewport-lock the camera
 * is frozen at 100%/origin, so the screen maps to world `[origin, origin+size]`.
 * With the lock OFF, we snapshot the CURRENT visible world rect at apply time
 * (tiling then doesn't follow later pans — lock ON is the intended tile setup).
 */
export function screenRect(store: BoardStore): Rect | null {
	const config = getWindowConfig(store);
	if (!config) return null;
	const size = canvasSize();
	if (!size) return null;
	if (viewportLockOf(store)) {
		return { x: config.originX, y: config.originY, width: size.width, height: size.height };
	}
	const vp = store.getViewport();
	const zoom = vp.zoom > 0 ? vp.zoom : 1;
	return { x: -vp.x / zoom, y: -vp.y / zoom, width: size.width / zoom, height: size.height / zoom };
}

/** The tiling area: the fixed screen inset by the outer padding. This is the rect
 *  the tree is laid out into (fullscreen ignores it and fills the whole screen).
 *  Exported so the service's geometric focus/move measure the same rectangles. */
export function tilingRect(store: BoardStore): Rect | null {
	const rect = screenRect(store);
	return rect ? insetRect(rect, paddingOf(store)) : null;
}

/** Resolve where every window should sit: the fullscreen window fills the screen;
 *  otherwise the reconciled tree is laid out. Also returns the (possibly updated)
 *  serialized tree so the caller can persist a reconcile. */
function resolvePlacements(
	store: BoardStore,
	rect: Rect,
): { placements: Placement[]; treeJson: string } {
	const ids = windowIds(store);
	const tree = reconcile(getTree(store), ids, focusedIdOf(store), defaultSplitOf(store));
	const treeJson = serializeTree(tree);
	const fs = fullscreenIdOf(store);
	if (fs && ids.includes(fs)) {
		// Fullscreen fills the whole screen, ignoring gap + outer padding (i3-style).
		return {
			placements: [{ id: fs, x: rect.x, y: rect.y, width: rect.width, height: rect.height }],
			treeJson,
		};
	}
	const inner = insetRect(rect, paddingOf(store));
	return { placements: layoutTree(tree, inner, gapOf(store)), treeJson };
}

/** Build the writes needed to bring the board to `placements` + the reconciled
 *  tree. Returns an empty array when nothing needs to change. */
function tileWrites(
	store: BoardStore,
	placements: readonly Placement[],
	treeJson: string,
): GuardedWrite[] {
	const writes: GuardedWrite[] = [];
	const config = getWindowConfig(store);
	if (config && config.tree !== treeJson) {
		writes.push({ id: config.id, before: { tree: config.tree }, after: { tree: treeJson } });
	}
	for (const p of placements) {
		const cur = store.getShape(p.id);
		if (!cur) continue;
		if (cur.x === p.x && cur.y === p.y && cur.width === p.width && cur.height === p.height)
			continue;
		writes.push({
			id: p.id,
			before: { x: cur.x, y: cur.y, width: cur.width, height: cur.height },
			after: { x: p.x, y: p.y, width: p.width, height: p.height },
		});
	}
	return writes;
}

/**
 * Lay every window out to the tree in ONE guarded+undoable command. No-op writes
 * are dropped, so it's safe to call speculatively (add/remove, actions). Does
 * nothing outside tile mode.
 */
export function applyTile(ctx: PluginContext): void {
	if (modeOf(ctx.store) !== "tile") return;
	const rect = screenRect(ctx.store);
	if (!rect) return;
	const { placements, treeJson } = resolvePlacements(ctx.store, rect);
	const writes = tileWrites(ctx.store, placements, treeJson);
	if (writes.length === 0) return;
	ctx.commands.execute(guardedCommand(ctx.store, writes));
}

/**
 * Lay every window out to an EXPLICIT tree in one guarded+undoable command. Used
 * by structural window operations (move / resize / split) which compute the edited
 * tree with the pure `tile-tree` helpers, so the tree edit + resulting window moves
 * revert together on undo. No-op outside tile mode (those ops require tiling).
 */
export function applyTileWithTree(ctx: PluginContext, tree: TileNode): void {
	if (modeOf(ctx.store) !== "tile") return;
	const rect = screenRect(ctx.store);
	if (!rect) return;
	const json = serializeTree(tree);
	const fs = fullscreenIdOf(ctx.store);
	const ids = windowIds(ctx.store);
	const placements =
		fs && ids.includes(fs)
			? [{ id: fs, x: rect.x, y: rect.y, width: rect.width, height: rect.height }]
			: layoutTree(tree, insetRect(rect, paddingOf(ctx.store)), gapOf(ctx.store));
	const writes = tileWrites(ctx.store, placements, json);
	if (writes.length === 0) return;
	ctx.commands.execute(guardedCommand(ctx.store, writes));
}

/**
 * Lay every window out WITHOUT a command (guarded, no undo entry). For automatic
 * layout the user didn't ask for — e.g. the fixed-screen refit on canvas resize —
 * where polluting the undo stack would be wrong.
 */
export function applyTileTransient(ctx: PluginContext): void {
	if (modeOf(ctx.store) !== "tile") return;
	const rect = screenRect(ctx.store);
	if (!rect) return;
	const { placements, treeJson } = resolvePlacements(ctx.store, rect);
	const writes = tileWrites(ctx.store, placements, treeJson);
	if (writes.length === 0) return;
	runGuarded(() => {
		for (const w of writes) ctx.store.updateShape(w.id, w.after);
	});
}

/**
 * Wire the tiling runtime. Returns a teardown removing every listener. It:
 *   - reconciles + retiles when a window is added or removed (tile mode),
 *   - snaps a dragged window back to its tree slot on drop (tile mode),
 *   - keeps `focusedId` synced to the single selected window.
 */
export function setupWindowRuntime(ctx: PluginContext): () => void {
	// Coalesce a burst of structural changes into one retile per frame.
	let pending = false;
	const scheduleTile = () => {
		if (pending) return;
		pending = true;
		scheduleFrame(() => {
			pending = false;
			applyTile(ctx);
		});
	};

	const offMutation = ctx.store.onMutation((event) => {
		if (windowWrites > 0) return; // ignore our own writes
		if (modeOf(ctx.store) !== "tile") return;
		if (event.type === "shape:added" || event.type === "shape:removed") {
			// A window (not the config substrate) entering/leaving changes the layout.
			scheduleTile();
			return;
		}
		if (event.type === "selection:changed") {
			const sel = [...ctx.store.getSelection()];
			if (sel.length === 1) {
				const shape = ctx.store.getShape(sel[0]);
				if (shape && isWindow(ctx.store, shape)) {
					runGuarded(() => setConfig(ctx.store, { focusedId: shape.id }));
				}
			}
		}
	});

	// Snap a dragged/edited window back to its tree slot on drop (tiled windows are
	// positioned by the tree, not by free dragging — reorder-by-drag is v2).
	const offMoveEnd = ctx.events.on("shapes:move-end", () => {
		if (modeOf(ctx.store) !== "tile") return;
		scheduleTile();
	});

	return () => {
		offMutation();
		offMoveEnd();
	};
}

/** Whether the board currently has any windows (for enabling actions). */
export function hasWindows(store: BoardStore): boolean {
	return windows(store).length > 0;
}
