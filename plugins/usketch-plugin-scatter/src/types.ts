import type {
	BoardStore,
	BoundingBox,
	CommandRegistry,
	Point,
	ShapeData,
	ShapeRegistry,
	ShapeStyle,
} from "@edv4h/usketch-shared";

/** A brand-new shape to spawn as part of a scatter. The engine assigns an id
 *  (`generateId()`) + the final x/y from the pattern, builds a valid base via the
 *  type's `ShapeDefinition.createDefault`, then merges these fields over it. */
export interface NewShapeSpec {
	id?: string;
	type: string;
	/** Required — the shape isn't in the store yet, so `getBounds` can't be used. */
	width: number;
	height: number;
	style?: Partial<ShapeStyle>;
	meta?: Record<string, unknown>;
	/** Intrinsic per-type fields (text, etc.). */
	[key: string]: unknown;
}

/** A scatter item is either an existing shape (moved) or a new shape (spawned). */
export type ScatterItem = { kind: "existing"; id: string } | { kind: "new"; spec: NewShapeSpec };

export interface ScatterDeps {
	store: BoardStore;
	shapes: ShapeRegistry;
	commands: CommandRegistry;
}

/** Resolve the seed's related set — pure over the store. Pluggable so "related"
 *  isn't hardcoded (connector neighbours, parent/children, or a host's own). */
export type RelationResolver = (deps: Pick<ScatterDeps, "store">, seedId: string) => ScatterItem[];

/** One item to place, with its INTRINSIC (unrotated, origin-anchored) bounds. */
export interface PatternItem {
	key: string;
	bounds: BoundingBox;
}

export interface PatternContext {
	seedBounds: BoundingBox;
	seedCenter: Point;
	items: PatternItem[];
	/** AABBs to avoid (the seed + non-item shapes) — used by `unoverlap`. */
	occupied: BoundingBox[];
	/** Gap between placed items, in world px. */
	spacing: number;
	/** Seeded PRNG in [0,1). Patterns MUST use this (never `Math.random`) for repro. */
	rng: () => number;
}

export interface Placement {
	key: string;
	x: number;
	y: number;
	rotation?: number;
}

/** A pure layout function: place the items around the seed. */
export type ScatterPattern = (ctx: PatternContext) => Placement[];

/** A seed POINT (with an optional radius) used instead of a seed shape — e.g. a
 *  tool that scatters around where the user clicked on empty canvas. The pattern
 *  sees `seedCenter = point` and `seedBounds` = the circle's AABB (a zero-size box
 *  at `point` when `radius` is omitted). Unlike a seed shape, the origin is NOT
 *  added to `occupied`: the circle is the area to fill, not an obstacle. So
 *  `radius` only steers patterns that read `seedBounds` (`radial`, `scatter`, or a
 *  host pattern); `unoverlap` / `grid` start right at `point`. */
export interface ScatterOrigin {
	point: Point;
	radius?: number;
}

export interface ScatterRequest {
	/** Seed shape id. Defaults to `origin` when given, else the sole selected shape. */
	seedId?: string;
	/** Seed point instead of a seed shape (ignored when `seedId` is given). With an
	 *  origin there is no seed shape, so a `relation` resolver can't be used — pass
	 *  explicit `items`. */
	origin?: ScatterOrigin;
	/** Limit `PatternContext.occupied` to shapes whose (rotated) `getBounds` AABB
	 *  intersects this box (must be finite, width/height >= 0). Default: every
	 *  shape on the board. */
	occupiedIn?: BoundingBox;
	/** Keep a shape in `PatternContext.occupied` only when this returns true — e.g.
	 *  let items land on frames/backgrounds. Default: keep every shape. */
	occupiedFilter?: (shape: ShapeData) => boolean;
	/** Explicit item set … */
	items?: ScatterItem[];
	/** … or derive it from the seed (a registered resolver name or a function). */
	relation?: string | RelationResolver;
	/** Layout (a registered pattern name or a function). */
	pattern: string | ScatterPattern;
	spacing?: number;
	/** RNG seed (number or string) for reproducible random patterns. */
	seed?: number | string;
	/** Fly-out animation (default `false` = instant). */
	animate?: boolean;
	durationMs?: number;
	easing?: (t: number) => number;
}

export interface ScatterResult {
	movedIds: string[];
	createdIds: string[];
}

/** Convenience alias for a fully-built shape produced by the engine. */
export type BuiltShape = ShapeData;
