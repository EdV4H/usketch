// The scatter orchestrator: resolve the seed + related items, run the chosen
// pattern to place them, spawn any new shapes, and apply everything as ONE
// undoable command (optionally animated first). Pure over its `deps` — the plugin
// and the service both call `scatter()`.
import {
	type BoundingBox,
	generateId,
	getRotatedAABB,
	type Point,
	type ShapeData,
	safeRotation,
} from "@edv4h/usketch-shared";
import { animatePositions, easeInOutCubic, type TweenTarget } from "./animate.js";
import { createScatterCommand } from "./command.js";
import { getScatterPattern } from "./patterns.js";
import { resolveItems } from "./resolvers.js";
import { hashSeed, mulberry32 } from "./rng.js";
import type {
	PatternItem,
	Placement,
	ScatterDeps,
	ScatterPattern,
	ScatterRequest,
	ScatterResult,
} from "./types.js";

const DEFAULT_SPACING = 24;
const DEFAULT_DURATION = 450;

function boundsOf(deps: ScatterDeps, shape: ShapeData): BoundingBox {
	const def = deps.shapes.get(shape.type);
	return def
		? def.getBounds(shape)
		: { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
}

function occupiedAABB(deps: ScatterDeps, shape: ShapeData): BoundingBox {
	const b = boundsOf(deps, shape);
	const rot = safeRotation(shape.rotation);
	return rot ? getRotatedAABB(b, rot) : b;
}

/** The sole selected shape id, or undefined when the selection isn't exactly one. */
function soleSelection(deps: ScatterDeps): string | undefined {
	const sel = deps.store.getSelection();
	return sel.size === 1 ? [...sel][0] : undefined;
}

interface ScatterPlan {
	newShapes: ShapeData[]; // at FINAL position
	newStarts: Map<string, Point>; // id → animation start (top-left)
	existingBefore: Map<string, ShapeData>;
	existingAfter: Map<string, Partial<Omit<ShapeData, "id">>>;
	tweens: TweenTarget[];
	movedIds: string[];
	createdIds: string[];
}

/** seedId wins; then an explicit origin; then the sole selected shape. */
function resolveSeed(deps: ScatterDeps, request: ScatterRequest): ScatterSeed {
	if (request.seedId === undefined && request.origin) {
		const { point, radius } = request.origin;
		if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
			throw new Error("[scatter] origin.point must be finite");
		}
		const r = radius !== undefined && Number.isFinite(radius) && radius > 0 ? radius : 0;
		return { kind: "origin", point, radius: r };
	}
	const seedId = request.seedId ?? soleSelection(deps);
	if (!seedId) {
		throw new Error(
			"[scatter] no seed: select exactly one shape or pass request.seedId / request.origin",
		);
	}
	const seedShape = deps.store.getShape(seedId);
	if (!seedShape) throw new Error(`[scatter] seed shape not found: ${seedId}`);
	return { kind: "shape", shape: seedShape };
}

/** Build the full plan: pattern placements → new shapes + existing move patches. */
/** The seed of a scatter: an existing shape, or a bare point (+ radius). */
type ScatterSeed =
	| { kind: "shape"; shape: ShapeData }
	| { kind: "origin"; point: Point; radius: number };

function seedGeometry(
	deps: ScatterDeps,
	seed: ScatterSeed,
): { seedBounds: BoundingBox; seedCenter: Point } {
	if (seed.kind === "origin") {
		const { point, radius } = seed;
		return {
			seedBounds: {
				x: point.x - radius,
				y: point.y - radius,
				width: radius * 2,
				height: radius * 2,
			},
			seedCenter: { x: point.x, y: point.y },
		};
	}
	const seedBounds = boundsOf(deps, seed.shape);
	return {
		seedBounds,
		seedCenter: { x: seedBounds.x + seedBounds.width / 2, y: seedBounds.y + seedBounds.height / 2 },
	};
}

function intersects(a: BoundingBox, b: BoundingBox): boolean {
	return (
		a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height
	);
}

/** Occupied = every shape that ISN'T a moving item (so items avoid the seed +
 *  unrelated shapes), optionally narrowed to `occupiedIn` and `occupiedFilter`. */
function collectOccupied(
	deps: ScatterDeps,
	request: ScatterRequest,
	movingIds: ReadonlySet<string>,
): BoundingBox[] {
	const { store } = deps;
	const area = request.occupiedIn;
	const candidates: ShapeData[] = [];
	if (area) {
		for (const id of store.getVisibleShapeIds(area)) {
			const s = store.getShape(id);
			if (s) candidates.push(s);
		}
	} else {
		for (const s of store.getShapes().values()) candidates.push(s);
	}
	const occupied: BoundingBox[] = [];
	for (const s of candidates) {
		if (movingIds.has(s.id)) continue;
		if (request.occupiedFilter && !request.occupiedFilter(s)) continue;
		const box = occupiedAABB(deps, s);
		// The spatial index may be coarse — re-check against the exact area.
		if (area && !intersects(box, area)) continue;
		occupied.push(box);
	}
	return occupied;
}

function planScatter(deps: ScatterDeps, seed: ScatterSeed, request: ScatterRequest): ScatterPlan {
	const { store, shapes } = deps;
	if (seed.kind === "origin" && !request.items && request.relation) {
		throw new Error("[scatter] a relation needs a seed shape — pass items when using origin");
	}
	const items =
		seed.kind === "shape"
			? resolveItems({ store }, seed.shape.id, request.relation, request.items)
			: (request.items ?? []);

	const { seedBounds, seedCenter } = seedGeometry(deps, seed);

	// Used by the `unoverlap` pattern (and any host pattern that avoids shapes).
	const movingIds = new Set(items.filter((i) => i.kind === "existing").map((i) => i.id));
	const occupied = collectOccupied(deps, request, movingIds);

	// Pattern items (INTRINSIC, origin-anchored bounds — matches PatternItem's
	// contract; patterns place by size, not world position) + a map back to source.
	type Source =
		| { kind: "existing"; id: string }
		| { kind: "new"; id: string; spec: Extract<(typeof items)[number], { kind: "new" }>["spec"] };
	const patternItems: PatternItem[] = [];
	const sources = new Map<string, Source>();
	const newIds = new Set<string>();
	items.forEach((it, i) => {
		if (it.kind === "existing") {
			const s = store.getShape(it.id);
			if (!s) return; // stale id — skip
			const b = boundsOf(deps, s);
			patternItems.push({ key: it.id, bounds: { x: 0, y: 0, width: b.width, height: b.height } });
			sources.set(it.id, { kind: "existing", id: it.id });
		} else {
			const { width, height } = it.spec;
			if (!(width > 0) || !(height > 0)) {
				throw new Error("[scatter] a new shape spec must carry positive width/height");
			}
			// Resolve + guard the id up-front so a caller-supplied `spec.id` can never
			// overwrite an existing shape (addShape overwrites) — which undo would then
			// wrongly delete — nor collide with another new spec in the same run.
			const id = typeof it.spec.id === "string" ? it.spec.id : generateId();
			if (store.getShape(id) || newIds.has(id)) {
				throw new Error(`[scatter] new shape id collides with an existing/duplicate id: ${id}`);
			}
			newIds.add(id);
			const key = `new:${i}`;
			patternItems.push({ key, bounds: { x: 0, y: 0, width, height } });
			sources.set(key, { kind: "new", id, spec: it.spec });
		}
	});

	const patternFn: ScatterPattern | undefined =
		typeof request.pattern === "function" ? request.pattern : getScatterPattern(request.pattern);
	if (!patternFn) throw new Error(`[scatter] unknown pattern: ${String(request.pattern)}`);

	const rng = mulberry32(hashSeed(request.seed ?? Math.floor(Math.random() * 0xffffffff)));
	const placements: Placement[] = patternFn({
		seedBounds,
		seedCenter,
		items: patternItems,
		occupied,
		spacing: request.spacing ?? DEFAULT_SPACING,
		rng,
	});

	const plan: ScatterPlan = {
		newShapes: [],
		newStarts: new Map(),
		existingBefore: new Map(),
		existingAfter: new Map(),
		tweens: [],
		movedIds: [],
		createdIds: [],
	};

	for (const p of placements) {
		const src = sources.get(p.key);
		if (!src) continue;
		if (src.kind === "existing") {
			const s = store.getShape(src.id);
			if (!s) continue;
			plan.existingBefore.set(src.id, { ...s });
			const patch: Partial<Omit<ShapeData, "id">> = { x: p.x, y: p.y };
			if (p.rotation !== undefined) patch.rotation = p.rotation;
			plan.existingAfter.set(src.id, patch);
			plan.movedIds.push(src.id);
			plan.tweens.push({ id: src.id, from: { x: s.x, y: s.y }, to: { x: p.x, y: p.y } });
		} else {
			const { spec, id } = src;
			const base = shapes.get(spec.type)?.createDefault({ id, x: p.x, y: p.y });
			if (!base) throw new Error(`[scatter] unknown shape type: ${spec.type}`);
			const { id: _sid, type: _stype, width, height, style: specStyle, ...rest } = spec;
			const shape: ShapeData = {
				...base,
				...(rest as Partial<ShapeData>),
				id,
				type: spec.type,
				x: p.x,
				y: p.y,
				width,
				height,
				style: { ...base.style, ...(specStyle ?? {}) },
			};
			if (p.rotation !== undefined) shape.rotation = p.rotation;
			plan.newShapes.push(shape);
			plan.createdIds.push(id);
			const start: Point = { x: seedCenter.x - width / 2, y: seedCenter.y - height / 2 };
			plan.newStarts.set(id, start);
			plan.tweens.push({ id, from: start, to: { x: p.x, y: p.y } });
		}
	}
	return plan;
}

/**
 * Scatter a seed shape's related shapes (and/or freshly spawned shapes) across the
 * canvas using the chosen pattern, as one undoable step. Optionally animated.
 */
export async function scatter(deps: ScatterDeps, request: ScatterRequest): Promise<ScatterResult> {
	const plan = planScatter(deps, resolveSeed(deps, request), request);
	if (plan.movedIds.length === 0 && plan.createdIds.length === 0) {
		return { movedIds: [], createdIds: [] };
	}

	const command = createScatterCommand(
		deps.store,
		plan.newShapes,
		plan.existingBefore,
		plan.existingAfter,
	);

	if (request.animate) {
		// Spawn new shapes at their START position (raw add — not a command), tween
		// everything to the target, then commit the command (idempotent) for one undo.
		for (const shape of plan.newShapes) {
			const start = plan.newStarts.get(shape.id);
			deps.store.addShape(start ? { ...shape, x: start.x, y: start.y } : shape);
		}
		await animatePositions(deps.store, plan.tweens, {
			durationMs: request.durationMs ?? DEFAULT_DURATION,
			easing: request.easing ?? easeInOutCubic,
		});
	}

	deps.commands.execute(command);
	return { movedIds: plan.movedIds, createdIds: plan.createdIds };
}
