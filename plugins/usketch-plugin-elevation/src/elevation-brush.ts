// The brush: dabs that change the heights inside a circle, on a stroke's working copy of
// the deltas. A stroke never writes the store while it is drawn: it keeps the chunks it
// touched in memory (as floats, so slow strokes don't round away), the layer draws its
// preview, and the stroke is written once, as one command, when it ends (see
// `strokeChanges` + `writeChunkEdits`). Pure: no store access here.
import {
	chunkKey,
	DELTA_SCALE,
	ELEVATION_FIELD_ID,
	type ElevationFieldConfig,
	MAX_HEIGHT,
	makeFieldShape,
	normalizeField,
} from "./elevation-field.js";
import { type DeltaValues, type ElevationModel, elevationSampler } from "./elevation-model.js";

export const BRUSH_MODES = ["raise", "lower", "smooth", "flatten", "terrace"] as const;
export type BrushMode = (typeof BRUSH_MODES)[number];

export const BRUSH_FALLOFFS = ["smooth", "linear", "flat"] as const;
/** How the brush's effect fades towards its edge. */
export type BrushFalloff = (typeof BRUSH_FALLOFFS)[number];

export interface BrushSettings {
	mode: BrushMode;
	/** World units. */
	radius: number;
	/** `1 … 100`. */
	strength: number;
	falloff: BrushFalloff;
	/** Height "flatten" levels to; `-1` = the height where the stroke starts. */
	flattenHeight: number;
	/** Height between two steps of "terrace" (world units). */
	terraceStep: number;
}

export const DEFAULT_BRUSH: BrushSettings = {
	mode: "raise",
	radius: 128,
	strength: 40,
	falloff: "smooth",
	flattenHeight: -1,
	terraceStep: 32,
};

export const MIN_RADIUS = 16;
export const MAX_RADIUS = 1024;
/** World units per second that "raise" / "lower" add at the centre, per point of strength. */
export const RAISE_RATE = 4;
/** How fast smooth / flatten / terrace close in (per second, at strength 100). */
const PULL_RATE = 12;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Settings with junk replaced by the defaults and values kept in range. Pure. */
export function normalizeBrush(raw: Partial<Record<keyof BrushSettings, unknown>>): BrushSettings {
	const num = (v: unknown, fallback: number) => {
		const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
		return typeof n === "number" && Number.isFinite(n) ? n : fallback;
	};
	const mode = BRUSH_MODES.includes(raw.mode as BrushMode)
		? (raw.mode as BrushMode)
		: DEFAULT_BRUSH.mode;
	const falloff = BRUSH_FALLOFFS.includes(raw.falloff as BrushFalloff)
		? (raw.falloff as BrushFalloff)
		: DEFAULT_BRUSH.falloff;
	const flat = num(raw.flattenHeight, DEFAULT_BRUSH.flattenHeight);
	return {
		mode,
		falloff,
		radius: clamp(num(raw.radius, DEFAULT_BRUSH.radius), MIN_RADIUS, MAX_RADIUS),
		strength: clamp(num(raw.strength, DEFAULT_BRUSH.strength), 1, 100),
		flattenHeight: flat < 0 ? -1 : Math.min(flat, MAX_HEIGHT),
		terraceStep: clamp(num(raw.terraceStep, DEFAULT_BRUSH.terraceStep), 1, 1024),
	};
}

/** The brush's weight at `t` = distance / radius (`0 … 1`): 1 at the centre, 0 past the edge. Pure. */
export function falloffWeight(t: number, falloff: BrushFalloff): number {
	if (!(t < 1)) return 0;
	const u = t < 0 ? 0 : t;
	if (falloff === "flat") return 1;
	if (falloff === "linear") return 1 - u;
	// smoothstep from the edge in
	const s = 1 - u;
	return s * s * (3 - 2 * s);
}

/** Where the weight is one half: the brush cursor's inner ring. Pure. */
export function halfWeightRadius(falloff: BrushFalloff): number {
	return falloff === "flat" ? 1 : 0.5;
}

/** A stroke in progress: the board's elevation as it started, plus the stroke's chunks. */
export interface Stroke {
	field: ElevationFieldConfig;
	/** The board had no field: writing the stroke creates it. */
	createsField: boolean;
	/** Deltas at the start, by chunk key (only chunks the stroke touched). `null` = none. */
	before: Map<string, DeltaValues | null>;
	/** The elevation with the stroke drawn so far (a new object after every step). */
	model: ElevationModel;
	/** Generated heights only (no deltas), to turn heights back into deltas. */
	base: ElevationModel;
}

/**
 * Start a stroke over the board's elevation (`null` when the board has no field: the
 * stroke then draws on a new flat field). Pure.
 */
export function beginStroke(model: ElevationModel | null): Stroke {
	const field = model?.field ?? normalizeField(makeFieldShape(ELEVATION_FIELD_ID));
	return {
		field,
		createsField: model === null,
		before: new Map(),
		model: { field, chunks: new Map(model?.chunks ?? []) },
		base: { field, chunks: new Map() },
	};
}

export interface DabOptions {
	settings: BrushSettings;
	/** The mode to use instead of `settings.mode` (Shift swaps raise / lower). */
	mode?: BrushMode;
	/** Target height of "flatten" (world units). */
	target?: number;
	/** Seconds the dab stands for (its effect scales with it). */
	dt: number;
}

/**
 * Apply one dab at world point `(x, y)`, replacing the stroke's `model` with a new
 * object (the chunks it changed are new arrays: nothing drawn before is mutated).
 * Returns whether any height changed.
 */
export function applyDab(stroke: Stroke, x: number, y: number, opts: DabOptions): boolean {
	return applyDabs(stroke, [{ x, y, dt: opts.dt }], opts);
}

/**
 * Apply dabs one after the other, as one step (one new `model`). Each dab's `dt`
 * replaces `opts.dt`. Returns whether any height changed.
 */
export function applyDabs(
	stroke: Stroke,
	dabs: readonly { x: number; y: number; dt: number }[],
	opts: Omit<DabOptions, "dt">,
): boolean {
	const sp = stroke.field.spacing;
	const s = opts.settings;
	const mode = opts.mode ?? s.mode;
	const r = s.radius;
	const { heightAt, write, commit } = strokeEditor(stroke);

	let changed = false;
	for (const dab of dabs) {
		if (!(dab.dt > 0) || !Number.isFinite(dab.x) || !Number.isFinite(dab.y)) continue;
		const i0 = Math.ceil((dab.x - r) / sp);
		const i1 = Math.floor((dab.x + r) / sp);
		const j0 = Math.ceil((dab.y - r) / sp);
		const j1 = Math.floor((dab.y + r) / sp);
		// Work out every new height from the heights before this dab, then write them.
		const updates: number[] = [];
		const pull = (w: number) => 1 - Math.exp(-w * (s.strength / 100) * PULL_RATE * dab.dt);
		for (let j = j0; j <= j1; j++) {
			for (let i = i0; i <= i1; i++) {
				const w = falloffWeight(Math.hypot(i * sp - dab.x, j * sp - dab.y) / r, s.falloff);
				if (w <= 0) continue;
				const h = heightAt(i, j);
				let next = h;
				if (mode === "raise") next = h + s.strength * RAISE_RATE * w * dab.dt;
				else if (mode === "lower") next = h - s.strength * RAISE_RATE * w * dab.dt;
				else if (mode === "smooth") {
					let sum = 0;
					for (let dj = -1; dj <= 1; dj++) {
						for (let di = -1; di <= 1; di++) sum += heightAt(i + di, j + dj);
					}
					next = h + (sum / 9 - h) * pull(w);
				} else if (mode === "flatten") {
					const target = opts.target ?? (s.flattenHeight >= 0 ? s.flattenHeight : h);
					next = h + (target - h) * pull(w);
				} else {
					const step = s.terraceStep;
					next = h + (Math.round(h / step) * step - h) * pull(w);
				}
				next = clamp(next, 0, MAX_HEIGHT);
				if (next !== h) updates.push(i, j, next);
			}
		}
		for (let k = 0; k < updates.length; k += 3) write(updates[k], updates[k + 1], updates[k + 2]);
		if (updates.length > 0) changed = true;
	}
	if (changed) commit();
	return changed;
}

/** Reads and writes grid heights on a stroke's working copy (see {@link strokeEditor}). */
export interface StrokeEditor {
	/** The height at grid node `(i, j)` with every write so far (world units). */
	heightAt(i: number, j: number): number;
	/** Set the height at grid node `(i, j)` (world units; kept as a delta over the base). */
	write(i: number, j: number, h: number): void;
	/** Publish the writes as the stroke's new `model` (once, after writing; no writes after). */
	commit(): void;
}

/**
 * Grid-level access to a stroke for edits that aren't brush dabs (e.g. levelling a
 * road): read heights, write new ones, then `commit` to replace `stroke.model` with a
 * new object (the chunks written are new arrays, as with the brush). Pure apart from
 * the stroke it is given.
 */
export function strokeEditor(stroke: Stroke): StrokeEditor {
	const { field } = stroke;
	const n = field.chunk;
	const chunks = new Map(stroke.model.chunks);
	/** Chunks already copied in this step (writable). */
	const fresh = new Set<string>();
	const baseOf = elevationSampler(stroke.base);
	const deltaAt = (i: number, j: number): number => {
		const cx = Math.floor(i / n);
		const cy = Math.floor(j / n);
		const a = chunks.get(chunkKey(cx, cy));
		return a ? a[(j - cy * n) * n + (i - cx * n)] / DELTA_SCALE : 0;
	};
	let committed = false;
	return {
		heightAt: (i, j) => clamp(baseOf.sample(i, j) + deltaAt(i, j), 0, MAX_HEIGHT),
		write: (i, j, h) => {
			// The committed chunks belong to the published model: never change them.
			if (committed) throw new Error("strokeEditor: write after commit");
			const cx = Math.floor(i / n);
			const cy = Math.floor(j / n);
			const key = chunkKey(cx, cy);
			let a = chunks.get(key);
			if (!fresh.has(key)) {
				if (!stroke.before.has(key)) stroke.before.set(key, a ?? null);
				const copy = new Float32Array(n * n);
				if (a) copy.set(a);
				a = copy;
				chunks.set(key, a);
				fresh.add(key);
			}
			(a as Float32Array)[(j - cy * n) * n + (i - cx * n)] =
				(h - baseOf.sample(i, j)) * DELTA_SCALE;
		},
		commit: () => {
			committed = true;
			stroke.model = { field, chunks };
		},
	};
}

/**
 * The dabs along a pointer's path from `from` to `to` over `dt` seconds: spaced a
 * quarter of the radius apart (a fast drag leaves no gaps), the time split between
 * them. A still pointer gets one dab. Pure.
 */
export function dabsAlong(
	from: { x: number; y: number },
	to: { x: number; y: number },
	dt: number,
	radius: number,
): { x: number; y: number; dt: number }[] {
	const dist = Math.hypot(to.x - from.x, to.y - from.y);
	const count = Math.max(1, Math.min(256, Math.ceil(dist / Math.max(1, radius / 4))));
	const out: { x: number; y: number; dt: number }[] = [];
	for (let k = 1; k <= count; k++) {
		const t = k / count;
		out.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, dt: dt / count });
	}
	return out;
}

/** One chunk's change, as stored: Int16 quarter units, `null` = no edits left there. */
export interface ChunkChange {
	cx: number;
	cy: number;
	values: Int16Array | null;
}

const sameValues = (a: DeltaValues | null, b: Int16Array | null): boolean => {
	if (a === null || b === null) return a === b;
	if (a.length !== b.length) return false;
	for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return false;
	return true;
};

/**
 * What the stroke changed, rounded to what is stored: one entry per touched chunk whose
 * stored values differ from before. A chunk back to all zeros becomes `null`. Pure.
 */
export function strokeChanges(stroke: Stroke): ChunkChange[] {
	const out: ChunkChange[] = [];
	for (const [key, before] of stroke.before) {
		const now = stroke.model.chunks.get(key);
		let values: Int16Array | null = null;
		if (now) {
			const q = new Int16Array(now.length);
			let any = false;
			for (let k = 0; k < now.length; k++) {
				q[k] = clamp(Math.round(now[k]), -32768, 32767);
				if (q[k] !== 0) any = true;
			}
			values = any ? q : null;
		}
		const was = before?.some((v) => v !== 0) ? before : null;
		if (sameValues(was, values)) continue;
		const [cx, cy] = key.split(",").map(Number);
		out.push({ cx, cy, values });
	}
	out.sort((a, b) => a.cy - b.cy || a.cx - b.cx);
	return out;
}
