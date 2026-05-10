import type { CanvasPointerEvent, Command, ShapeData } from "@edv4h/usketch-shared";

/**
 * Common shape for the four "session" helpers (drag/resize/rotate/marquee).
 * A session is created on `pointerdown` (e.g. `startDragSession({...})`),
 * mutated on each `pointermove` via `update()`, and finalized on
 * `pointerup` via `commit()` (or `cancel()` to abort without producing a
 * command).
 *
 * `update()` returns a per-session struct (e.g. `DragUpdate`) so callers can
 * drive UI overlays from the same data the session uses internally to write
 * to the store. `commit()` returns a `Command` for the caller to schedule
 * via `ctx.commands.execute(...)` — sessions never execute commands or
 * emit tool-specific events themselves, so they remain reusable across
 * tools that have different undo/event policies.
 */
export interface ToolSession<TUpdate, TCommit> {
	update(event: CanvasPointerEvent): TUpdate;
	commit(): TCommit | null;
	cancel(): void;
}

/**
 * Common commit shape for sessions that produce a single undo command.
 * Sessions return `null` from `commit()` if no observable change happened
 * (e.g. drag with delta < 1px) so the caller can skip the command.
 */
export interface SessionCommit {
	command: Command;
}

/**
 * Map of `shapeId -> partial update` produced by a session's `update()`.
 * The session has already applied these to the store via
 * `ctx.store.updateShape(...)`; the map is exposed so overlays can read the
 * same diff without round-tripping through the store.
 */
export type ShapeUpdateMap = Map<string, Partial<ShapeData>>;
