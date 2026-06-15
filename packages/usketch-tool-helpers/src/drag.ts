import type { CanvasPointerEvent, Point, ShapeData, ToolContext } from "@edv4h/usketch-shared";
import { createMoveShapesCommand } from "@edv4h/usketch-store";
import { collectSelectionWithDescendants } from "./internal/descendants.js";
import type { SessionCommit, ShapeUpdateMap, ToolSession } from "./types.js";

export interface DragUpdate {
	/** Pointer delta from session start, before snap. */
	delta: Point;
	/**
	 * Additional offset the snap callback (or store) applied on top of `delta`.
	 * Children are translated by `delta + snapDelta` so they follow the
	 * snapped parent position.
	 */
	snapDelta: Point;
	/** Per-shape diff this update applied to the store. */
	updates: ShapeUpdateMap;
}

export interface DragSessionOptions {
	ctx: ToolContext;
	startPoint: Point;
	/** Top-level shape IDs the user is dragging (typically the current selection). */
	shapeIds: Iterable<string>;
	/**
	 * Whether to also drag descendants of any container (group/frame/island)
	 * in `shapeIds`. Default `true` — matches `tool-select`'s behavior. Set to
	 * `false` for tools that want to move only the top-level shapes.
	 */
	includeDescendants?: boolean;
	/**
	 * Predicate deciding whether a shape's children should follow it on move.
	 * Defaults to the container check (group/frame/island). Pass a custom
	 * predicate to also drag children of ordinary (non-container) parents —
	 * e.g. a sticker/reaction attached via `parentId` to an arbitrary shape.
	 * Only consulted when `includeDescendants` is `true` (the default).
	 */
	followChildrenOf?: (shape: ShapeData) => boolean;
	/**
	 * Optional hook the caller can use to nudge the drag offset (e.g. for snap
	 * plugins). Receives the raw delta and returns a (possibly adjusted) delta.
	 * The session does NOT inspect the store to derive snap — calling code is
	 * expected to drive snap entirely through this hook.
	 *
	 * Note: the existing `tool-select` flow lets the *store* perform snap
	 * (via plugin event listeners on `updateShape`) and then reads back the
	 * snapped position. This helper preserves that idiom by reading the
	 * store after each `updateShape` call; `onSnap` here is an additional
	 * pre-store hook for tools that want pure-functional snap. Most callers
	 * will leave this undefined.
	 */
	onSnap?: (delta: Point) => Point;
}

/**
 * Per-shape data captured at session start so we can compute the new
 * position via `snapshot.x + dx`, run the shape's `move` hook against the
 * original geometry, and revert+replay through a single command on commit.
 */
interface DragSnapshot {
	shape: ShapeData;
	isRoot: boolean;
}

/**
 * The drag session is a specialization of {@link ToolSession} that also
 * exposes the full set of shape IDs it has captured for the move (roots
 * plus any descendants resolved via `collectSelectionWithDescendants`).
 * Tools need this for things like drop-target hit testing — without it,
 * dragging a container would falsely identify its own descendant
 * frames/groups as drop targets.
 */
export interface DragSession extends ToolSession<DragUpdate, SessionCommit> {
	/** Read-only view of every shape ID this session is moving. */
	readonly movingShapeIds: ReadonlySet<string>;
}

/**
 * Drag/move session — extracted from `plugin-tool-select`'s `mode: "move"`
 * branch. Mirrors that flow exactly: take a snapshot of every shape that
 * will move (including descendants of containers), then on each pointermove
 * translate root shapes first (so plugin snap can adjust them), measure the
 * snap delta, and translate descendants by `delta + snapDelta` so they
 * follow.
 *
 * `commit()` builds a `createMoveShapesCommand` from the before/after
 * snapshots and reverts the store to "before" — the caller is expected to
 * `queueMicrotask(() => ctx.commands.execute(result.command))` so any
 * pointer-up cleanup (e.g. snap teardown) lands first.
 */
export function startDragSession(opts: DragSessionOptions): DragSession {
	const { ctx, startPoint, shapeIds, includeDescendants = true, followChildrenOf, onSnap } = opts;

	const startShapeSnapshots: Map<string, DragSnapshot> = new Map();
	const rootIds = new Set<string>();
	for (const id of shapeIds) rootIds.add(id);

	const collected = includeDescendants
		? collectSelectionWithDescendants(ctx, rootIds, { followChildrenOf })
		: collectShapesOnly(ctx, rootIds);
	for (const [id, snap] of collected) {
		startShapeSnapshots.set(id, { shape: snap, isRoot: rootIds.has(id) });
	}

	const movingShapeIds: ReadonlySet<string> = new Set(startShapeSnapshots.keys());

	let lastUpdate: DragUpdate = {
		delta: { x: 0, y: 0 },
		snapDelta: { x: 0, y: 0 },
		updates: new Map(),
	};
	let cancelled = false;

	function applyMoveHook(id: string, snapshot: ShapeData, updates: ShapeUpdateMap): void {
		const def = ctx.shapes.get(snapshot.type);
		if (!def?.move) return;
		const snapped = ctx.store.getShape(id);
		if (!snapped) return;
		const dx = snapped.x - snapshot.x;
		const dy = snapped.y - snapshot.y;
		const geom = def.move(snapshot, dx, dy);
		const { x: _x, y: _y, ...rest } = geom;
		if (Object.keys(rest).length > 0) {
			ctx.store.updateShape(id, rest);
			merge(updates, id, rest);
		}
	}

	return {
		movingShapeIds,
		update(event: CanvasPointerEvent): DragUpdate {
			if (cancelled) return lastUpdate;
			const rawDelta = {
				x: event.worldPoint.x - startPoint.x,
				y: event.worldPoint.y - startPoint.y,
			};
			const adjusted = onSnap ? onSnap(rawDelta) : rawDelta;
			const updates: ShapeUpdateMap = new Map();

			let snapDx = 0;
			let snapDy = 0;
			// Phase 1: roots — snap may adjust them, capture the delta.
			for (const [id, { shape, isRoot }] of startShapeSnapshots) {
				if (!isRoot) continue;
				const next = { x: shape.x + adjusted.x, y: shape.y + adjusted.y };
				ctx.store.updateShape(id, next);
				merge(updates, id, next);
				const snapped = ctx.store.getShape(id);
				if (snapped) {
					snapDx = snapped.x - next.x;
					snapDy = snapped.y - next.y;
				}
				applyMoveHook(id, shape, updates);
			}

			// Phase 2: descendants — apply the same snap delta so they follow.
			for (const [id, { shape, isRoot }] of startShapeSnapshots) {
				if (isRoot) continue;
				const next = {
					x: shape.x + adjusted.x + snapDx,
					y: shape.y + adjusted.y + snapDy,
				};
				ctx.store.updateShape(id, next);
				merge(updates, id, next);
				applyMoveHook(id, shape, updates);
			}

			lastUpdate = {
				delta: adjusted,
				snapDelta: { x: snapDx, y: snapDy },
				updates,
			};
			return lastUpdate;
		},

		commit(): SessionCommit | null {
			if (cancelled) return null;
			const beforeSnapshots = new Map<string, ShapeData>();
			const afterSnapshots = new Map<string, ShapeData>();
			let hasMoved = false;

			for (const [id, { shape }] of startShapeSnapshots) {
				const current = ctx.store.getShape(id);
				if (!current) continue;
				beforeSnapshots.set(id, shape);
				afterSnapshots.set(id, { ...current });
				if (Math.abs(current.x - shape.x) > 0.5 || Math.abs(current.y - shape.y) > 0.5) {
					hasMoved = true;
				}
			}

			if (!hasMoved) return null;

			// Revert to "before" so the command's execute() will replay the move.
			// Mirrors tool-select's deferred-execute idiom: callers schedule
			// `ctx.commands.execute(command)` via queueMicrotask so any pointer-up
			// cleanup (snap, drop-target) finishes before undo state is taken.
			for (const [id, before] of beforeSnapshots) {
				ctx.store.updateShape(id, before);
			}

			return {
				command: createMoveShapesCommand(ctx.store, beforeSnapshots, afterSnapshots),
			};
		},

		cancel(): void {
			if (cancelled) return;
			cancelled = true;
			// Revert to "before" — the user pressed Escape mid-drag.
			for (const [id, { shape }] of startShapeSnapshots) {
				ctx.store.updateShape(id, shape);
			}
		},
	};
}

function merge(target: ShapeUpdateMap, id: string, patch: Partial<ShapeData>): void {
	const existing = target.get(id);
	target.set(id, existing ? { ...existing, ...patch } : { ...patch });
}

function collectShapesOnly(ctx: ToolContext, ids: Iterable<string>): Map<string, ShapeData> {
	const map = new Map<string, ShapeData>();
	for (const id of ids) {
		const shape = ctx.store.getShape(id);
		if (shape) map.set(id, { ...shape });
	}
	return map;
}
