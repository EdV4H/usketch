import type { BoardStore, Command } from "../types/plugin.js";
import type { ShapeData } from "../types/shape.js";
import { canonicalJson } from "./canonical-json.js";
import { HISTORY_EXCLUDED_SHAPE_KEYS, type ShapeCollection, shapeEntries } from "./objects.js";

/** Keys a restore never writes through `updateShape`. */
const NEVER_UPDATED_KEYS: ReadonlySet<string> = new Set(["id", "type", "createdAt"]);

/** What a restore does to the current board to make it equal the target. */
export interface RestorePlan {
	/** Shapes to add, parents before their children. */
	add: ShapeData[];
	/** Shape ids to delete. */
	remove: string[];
	/** Partial updates. A key mapped to `undefined` is one the target does not have. */
	update: { id: string; changes: Partial<Omit<ShapeData, "id">> }[];
}

/** Options for {@link planRestore} / {@link createRestoreCommand}. */
export interface RestoreOptions {
	/**
	 * Restore only these shape ids (`git checkout <commit> -- <path>`). Shapes
	 * outside the list are left alone. Omit to restore the whole board.
	 */
	ids?: Iterable<string>;
}

/**
 * Work out the edits that turn `current` into `target`. Pure: nothing is
 * touched. A shape whose `type` changed is removed and added again, because a
 * shape cannot change type in place.
 */
export function planRestore(
	current: ShapeCollection,
	target: ShapeCollection,
	options: RestoreOptions = {},
): RestorePlan {
	const only = options.ids ? new Set(options.ids) : null;
	const inScope = ([id]: [string, ShapeData]) => !only || only.has(id);
	const currentById = new Map(shapeEntries(current).filter(inScope));
	const targetById = new Map(shapeEntries(target).filter(inScope));
	const add: ShapeData[] = [];
	const remove: string[] = [];
	const update: RestorePlan["update"] = [];

	for (const [id, wanted] of targetById) {
		const existing = currentById.get(id);
		if (!existing) {
			add.push(wanted);
			continue;
		}
		if (existing.type !== wanted.type) {
			remove.push(id);
			add.push(wanted);
			continue;
		}
		const changes = shapeChanges(existing, wanted);
		if (changes) update.push({ id, changes });
	}
	for (const id of currentById.keys()) {
		if (!targetById.has(id)) remove.push(id);
	}
	return { add: parentsFirst(add), remove: remove.sort(), update };
}

/** True when the plan changes nothing. */
export function isEmptyRestorePlan(plan: RestorePlan): boolean {
	return plan.add.length === 0 && plan.remove.length === 0 && plan.update.length === 0;
}

/**
 * Apply a plan to the store: deletes, then adds, then updates. With a Yjs
 * sync plugin the store mutations reach the shared doc like any other edit,
 * so collaborators receive the restore and their own undo is unaffected.
 */
export function applyRestorePlan(store: BoardStore, plan: RestorePlan): void {
	for (const id of plan.remove) store.deleteShape(id);
	for (const shape of plan.add) store.addShape(shape);
	for (const { id, changes } of plan.update) store.updateShape(id, changes);
}

/**
 * Wrap a restore as one undoable {@link Command} (for `commands.execute`).
 * `execute` restores `target`; `undo` puts back the shapes the restore touched
 * exactly as they were right before it ran.
 */
export function createRestoreCommand(
	store: BoardStore,
	target: ShapeCollection,
	options: RestoreOptions = {},
): Command {
	const targetShapes = new Map(shapeEntries(target));
	const scope: RestoreOptions = options.ids ? { ids: [...options.ids] } : {};
	let before = new Map<string, ShapeData>();
	let touched: string[] = [];
	return {
		execute() {
			const plan = planRestore(store.getShapes(), targetShapes, scope);
			touched = [
				...plan.remove,
				...plan.add.map((shape) => shape.id),
				...plan.update.map(({ id }) => id),
			];
			before = pick(store.getShapes(), touched);
			applyRestorePlan(store, plan);
		},
		undo() {
			applyRestorePlan(store, planRestore(pick(store.getShapes(), touched), before));
		},
	};
}

function pick(
	shapes: ReadonlyMap<string, ShapeData>,
	ids: readonly string[],
): Map<string, ShapeData> {
	const picked = new Map<string, ShapeData>();
	for (const id of ids) {
		const shape = shapes.get(id);
		if (shape) picked.set(id, shape);
	}
	return picked;
}

function shapeChanges(
	existing: ShapeData,
	wanted: ShapeData,
): Partial<Omit<ShapeData, "id">> | null {
	const existingRec = existing as unknown as Record<string, unknown>;
	const wantedRec = wanted as unknown as Record<string, unknown>;
	const changes: Record<string, unknown> = {};
	let changed = false;
	for (const key of new Set([...Object.keys(existingRec), ...Object.keys(wantedRec)])) {
		if (NEVER_UPDATED_KEYS.has(key) || HISTORY_EXCLUDED_SHAPE_KEYS.has(key)) continue;
		if (canonicalJson(existingRec[key]) !== canonicalJson(wantedRec[key])) {
			changes[key] = wantedRec[key];
			changed = true;
		}
	}
	return changed ? (changes as Partial<Omit<ShapeData, "id">>) : null;
}

/** Order shapes so a parent that is also being added comes before its children. */
function parentsFirst(shapes: ShapeData[]): ShapeData[] {
	const byId = new Map(shapes.map((shape) => [shape.id, shape]));
	const ordered: ShapeData[] = [];
	const visited = new Set<string>();
	const visit = (shape: ShapeData, path: Set<string>) => {
		if (visited.has(shape.id) || path.has(shape.id)) return;
		path.add(shape.id);
		const parent = shape.parentId ? byId.get(shape.parentId) : undefined;
		if (parent) visit(parent, path);
		visited.add(shape.id);
		ordered.push(shape);
	};
	for (const shape of [...shapes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
		visit(shape, new Set());
	}
	return ordered;
}
