// Operations on the board's elevation, as plain functions over a BoardStore (the HUD
// and the service only call these). Each one is a single undo step when a command
// registry is given, and writes straight to the store otherwise.
import type { BoardStore, Command, CommandRegistry, ShapeData } from "@edv4h/usketch-shared";
import {
	chunkShapeId,
	DEFAULT_GEN,
	DEFAULT_WATER_RATIO,
	ELEVATION_FIELD_ID,
	type ElevationChunkShape,
	type ElevationFieldConfig,
	type ElevationFieldShape,
	type ElevationGenParams,
	isElevationChunk,
	MAX_HEIGHT,
	makeChunkShape,
	makeFieldShape,
	normalizeField,
	normalizeGen,
} from "./elevation-field.js";

export { ELEVATION_FIELD_ID } from "./elevation-field.js";

import {
	applyDabs,
	type BrushMode,
	type BrushSettings,
	beginStroke,
	type ChunkChange,
	DEFAULT_BRUSH,
	dabsAlong,
	normalizeBrush,
	strokeChanges,
} from "./elevation-brush.js";
import { encodeChunk } from "./elevation-codec.js";
import { boardElevation, boardField, elevationSampler } from "./elevation-model.js";

export interface ElevationDeps {
	store: BoardStore;
	/** Run the change as one undoable command. Omitted: applied directly. */
	commands?: CommandRegistry;
}

/** Seed used when the infinite terrain is made without one. */
export const DEFAULT_ELEVATION_SEED = 1;

function run(deps: ElevationDeps, command: Command): void {
	if (deps.commands) deps.commands.execute(command);
	else command.execute();
}

/** The board's field settings, or `null` when it has none. */
export function getElevationField(store: BoardStore): ElevationFieldConfig | null {
	const shape = boardField(store.getShapes().values());
	return shape ? normalizeField(shape) : null;
}

export interface EnableElevationOptions {
	/** Integer seed. Omitted: keep the current one, else {@link DEFAULT_ELEVATION_SEED}. */
	seed?: number;
	/** Generator parameters over the current ones (else the defaults). */
	gen?: Partial<Omit<ElevationGenParams, "v">>;
	/**
	 * Water level (world units), `null` for none. Omitted: keep the current one; a new
	 * terrain gets {@link DEFAULT_WATER_RATIO} of its relief.
	 */
	waterLevel?: number | null;
}

/**
 * Turn the infinite terrain on (or change its seed / parameters / water): sets them on
 * the board's field, creating the field on a board without one. The parameters are
 * stored with it, so later changes to the defaults never reshape an existing board.
 * Returns the seed. Throws `RangeError` on a non-integer seed.
 */
export function enableInfiniteElevation(
	deps: ElevationDeps,
	opts: EnableElevationOptions = {},
): number {
	const shape = boardField(deps.store.getShapes().values());
	const current = shape ? normalizeField(shape) : null;
	const raw = opts.seed ?? current?.seed ?? DEFAULT_ELEVATION_SEED;
	const seed = Number(raw);
	if (!Number.isInteger(seed)) {
		throw new RangeError(`enableInfiniteElevation: seed must be an integer, got ${String(raw)}`);
	}
	// Only the parameters actually given replace the current ones.
	const given = Object.fromEntries(
		Object.entries(opts.gen ?? {}).filter(([, v]) => v !== undefined),
	);
	const gen = normalizeGen({ ...(shape?.gen && current ? current.gen : DEFAULT_GEN), ...given });
	const waterLevel =
		opts.waterLevel === null
			? undefined
			: opts.waterLevel !== undefined
				? Math.min(MAX_HEIGHT, Math.max(0, Number(opts.waterLevel) || 0))
				: (current?.waterLevel ?? Math.round(gen.relief * DEFAULT_WATER_RATIO));
	if (!shape) {
		const field = makeFieldShape(ELEVATION_FIELD_ID, { seed, gen, waterLevel });
		run(deps, {
			execute: () => deps.store.addShape(field),
			undo: () => deps.store.deleteShape(field.id),
		});
		return seed;
	}
	const id = shape.id;
	const from = { seed: shape.seed, gen: shape.gen, waterLevel: shape.waterLevel };
	const to = { seed, gen, waterLevel };
	run(deps, {
		execute: () => deps.store.updateShape(id, to as Partial<ShapeData>),
		undo: () => deps.store.updateShape(id, from as Partial<ShapeData>),
	});
	return seed;
}

/** Turn the infinite terrain off (the ground under the edits goes flat). Keeps the edits. */
export function disableInfiniteElevation(deps: ElevationDeps): void {
	const shape = boardField(deps.store.getShapes().values());
	if (!shape || shape.seed === undefined) return;
	const id = shape.id;
	const from = { seed: shape.seed, waterLevel: shape.waterLevel };
	run(deps, {
		execute: () =>
			deps.store.updateShape(id, { seed: undefined, waterLevel: undefined } as Partial<ShapeData>),
		undo: () => deps.store.updateShape(id, from as Partial<ShapeData>),
	});
}

function chunkShapesOf(store: BoardStore, fieldId: string): ShapeData[] {
	const out: ShapeData[] = [];
	for (const s of store.getShapes().values()) {
		if (isElevationChunk(s) && s.field === fieldId) out.push(s);
	}
	return out;
}

function deleteShapes(deps: ElevationDeps, shapes: ShapeData[]): void {
	if (shapes.length === 0) return;
	run(deps, {
		execute: () => {
			for (const s of shapes) deps.store.deleteShape(s.id);
		},
		undo: () => {
			for (const s of shapes) deps.store.addShape(s);
		},
	});
}

/** Remove every brush edit (back to the generated terrain, or a flat board). */
export function clearElevationEdits(deps: ElevationDeps): void {
	const shape = boardField(deps.store.getShapes().values());
	if (shape) deleteShapes(deps, chunkShapesOf(deps.store, shape.id));
}

/** Remove the board's field and all its edits: the board has no elevation any more. */
export function removeElevationField(deps: ElevationDeps): void {
	const shape: ElevationFieldShape | null = boardField(deps.store.getShapes().values());
	if (shape) deleteShapes(deps, [shape, ...chunkShapesOf(deps.store, shape.id)]);
}

/** Number of edited chunks on the board's field. */
export function editedChunkCount(store: BoardStore): number {
	const shape = boardField(store.getShapes().values());
	return shape ? chunkShapesOf(store, shape.id).length : 0;
}

// ── Brush edits ──

/** The stored `data` of a chunk shape now (`null` = no such chunk). */
function chunkData(store: BoardStore, id: string): string | null {
	const s = store.getShape(id);
	return s && isElevationChunk(s) ? s.data : null;
}

/**
 * Write chunk changes (a brush stroke) as one command: a new chunk is added, a chunk
 * with no edits left is removed, the others are updated. On a board without a field a
 * flat one is created first (in the same command). Undo and redo leave alone a chunk
 * someone else changed since (its data isn't what this command wrote): the other
 * person's edit wins there rather than being thrown away.
 */
export function writeChunkEdits(deps: ElevationDeps, changes: readonly ChunkChange[]): void {
	if (changes.length === 0) return;
	const { store } = deps;
	const existing = boardField(store.getShapes().values());
	const newField = existing ? null : makeFieldShape(ELEVATION_FIELD_ID);
	const field = normalizeField(existing ?? (newField as ElevationFieldShape));
	const items = changes.map((c) => {
		const id = chunkShapeId(field.id, c.cx, c.cy);
		const old = store.getShape(id);
		return {
			id,
			before: old && isElevationChunk(old) ? old : null,
			after: c.values ? makeChunkShape(field, c.cx, c.cy, encodeChunk(c.values)) : null,
		};
	});
	const put = (id: string, shape: ElevationChunkShape | null) => {
		const cur = store.getShape(id);
		if (shape === null) {
			if (cur) store.deleteShape(id);
		} else if (cur) {
			store.updateShape(id, { data: shape.data } as Partial<ShapeData>);
		} else {
			store.addShape(shape);
		}
	};
	let first = true;
	run(deps, {
		execute: () => {
			if (newField && !store.getShape(newField.id)) store.addShape(newField);
			for (const it of items) {
				// Redo: only where the chunk is still as the undo left it.
				if (!first && chunkData(store, it.id) !== (it.before?.data ?? null)) continue;
				put(it.id, it.after);
			}
			first = false;
		},
		undo: () => {
			for (const it of items) {
				if (chunkData(store, it.id) !== (it.after?.data ?? null)) continue;
				put(it.id, it.before);
			}
			// A field this command made goes again, unless it is in use now (terrain turned
			// on, or chunks someone else painted).
			if (newField) {
				const cur = store.getShape(newField.id);
				const inUse =
					!cur ||
					(cur as ElevationFieldShape).seed !== undefined ||
					[...store.getShapes().values()].some(
						(s) => isElevationChunk(s) && s.field === newField.id,
					);
				if (!inUse) store.deleteShape(newField.id);
			}
		},
	});
}

export interface PaintOptions {
	/** The brush (missing values: the defaults). */
	brush?: Partial<BrushSettings>;
	/** Mode instead of `brush.mode`. */
	mode?: BrushMode;
	/** Seconds the brush is held along the whole path. Default 0.5. */
	seconds?: number;
}

/**
 * One brush stroke along `path` (world points), written as one undo step: what the
 * elevation tool does between pointer down and up, for a host or a script. "flatten"
 * without a height levels to the height under the first point. Returns the number of
 * chunks changed.
 */
export function paintElevation(
	deps: ElevationDeps,
	path: readonly { x: number; y: number }[],
	opts: PaintOptions = {},
): number {
	if (path.length === 0) return 0;
	const settings = normalizeBrush({ ...DEFAULT_BRUSH, ...opts.brush });
	const stroke = beginStroke(boardElevation(deps.store));
	const mode = opts.mode ?? settings.mode;
	const target =
		mode === "flatten" && settings.flattenHeight < 0
			? elevationSampler(stroke.model).heightAt(path[0].x, path[0].y)
			: undefined;
	const seconds = opts.seconds ?? 0.5;
	const legs = Math.max(1, path.length - 1);
	const dabs =
		path.length === 1
			? [{ ...path[0], dt: seconds }]
			: path.slice(1).flatMap((p, k) => dabsAlong(path[k], p, seconds / legs, settings.radius));
	applyDabs(stroke, dabs, { settings, mode, target });
	const changes = strokeChanges(stroke);
	writeChunkEdits(deps, changes);
	return changes.length;
}
