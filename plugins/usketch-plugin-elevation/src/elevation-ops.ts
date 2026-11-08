// Operations on the board's elevation, as plain functions over a BoardStore (the HUD
// and the service only call these). Each one is a single undo step when a command
// registry is given, and writes straight to the store otherwise.
import type { BoardStore, Command, CommandRegistry, ShapeData } from "@edv4h/usketch-shared";
import {
	DEFAULT_GEN,
	DEFAULT_WATER_RATIO,
	type ElevationFieldConfig,
	type ElevationFieldShape,
	type ElevationGenParams,
	isElevationChunk,
	MAX_HEIGHT,
	makeFieldShape,
	normalizeField,
	normalizeGen,
} from "./elevation-field.js";
import { boardField } from "./elevation-model.js";

export interface ElevationDeps {
	store: BoardStore;
	/** Run the change as one undoable command. Omitted: applied directly. */
	commands?: CommandRegistry;
}

/** Seed used when the infinite terrain is made without one. */
export const DEFAULT_ELEVATION_SEED = 1;

/**
 * The id every client gives the field it creates. Fixed, so two clients turning the
 * terrain on at once write the same shape (one field) instead of two fields whose
 * chunk ids (`elev:<field>:…`) differ — the edits on the field that doesn't win would
 * otherwise be lost.
 */
export const ELEVATION_FIELD_ID = "elevation-field";

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
