// Board-history operations as plain functions over BoardStore / CommandRegistry /
// EventBus, so a host can drive them without the HUD (docs/plugin-system-design.md).
import {
	type BoardStore,
	type CommandRegistry,
	createRestoreCommand,
	type EventBus,
	isEmptyRestorePlan,
	planRestore,
	type RestorePlan,
	type ShapeData,
} from "@edv4h/usketch-shared";
import type { HistoryClient, HistoryCommitSummary } from "./history-client.js";

/** First 7 characters of a hash, like `git log --oneline`. */
export function shortHash(hash: string): string {
	return hash.slice(0, 7);
}

/**
 * Bring the board (or only `ids`) back to `shapes` as one undoable command.
 * Returns the plan that was applied; an empty plan changes nothing and adds no
 * undo step.
 */
export function restoreShapes(
	store: BoardStore,
	commands: CommandRegistry,
	shapes: readonly ShapeData[],
	options: { ids?: readonly string[] } = {},
): RestorePlan {
	const plan = planRestore(store.getShapes(), shapes, options);
	if (!isEmptyRestorePlan(plan)) commands.execute(createRestoreCommand(store, shapes, options));
	return plan;
}

export interface RestoreCommitDeps {
	store: BoardStore;
	commands: CommandRegistry;
	client: HistoryClient;
}

export interface RestoreCommitResult {
	plan: RestorePlan;
	/** The version saved right before restoring, or `null` when nothing was saved. */
	backup: HistoryCommitSummary | null;
}

/**
 * Restore a commit. Unless `saveBefore` is false, the current board is first
 * saved as a version, so the restore can be undone from history even after
 * the local undo stack is gone. The restore itself reaches collaborators like
 * any edit and is picked up by the server's next auto commit.
 */
export async function restoreCommit(
	deps: RestoreCommitDeps,
	hash: string,
	options: { ids?: readonly string[]; saveBefore?: boolean } = {},
): Promise<RestoreCommitResult> {
	const detail = await deps.client.getCommit(hash);
	const scope = options.ids ? { ids: options.ids } : {};
	const planned = planRestore(deps.store.getShapes(), detail.shapes, scope);
	if (isEmptyRestorePlan(planned)) return { plan: planned, backup: null };

	const backup =
		options.saveBefore === false
			? null
			: await deps.client.createCommit({
					message: `${shortHash(hash)} に戻す前`,
					trigger: "manual",
				});
	// Re-plans against the board as it is now (it may have changed while saving).
	const plan = restoreShapes(deps.store, deps.commands, detail.shapes, scope);
	return { plan, backup };
}

/** Show `shapes` on the canvas instead of the live board (read-only preview). */
export function enterPreview(events: EventBus, shapes: readonly ShapeData[]): void {
	events.emit("time-travel:enter", { shapes: new Map(shapes.map((s) => [s.id, s])) });
}

export function exitPreview(events: EventBus): void {
	events.emit("time-travel:exit", {});
}
