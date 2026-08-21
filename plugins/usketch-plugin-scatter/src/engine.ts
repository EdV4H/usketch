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

/** Build the full plan: pattern placements → new shapes + existing move patches. */
function planScatter(
	deps: ScatterDeps,
	seedShape: ShapeData,
	request: ScatterRequest,
): ScatterPlan {
	const { store, shapes } = deps;
	const items = resolveItems({ store }, seedShape.id, request.relation, request.items);

	const seedBounds = boundsOf(deps, seedShape);
	const seedCenter: Point = {
		x: seedBounds.x + seedBounds.width / 2,
		y: seedBounds.y + seedBounds.height / 2,
	};

	// Occupied = every shape that ISN'T a moving item (so items avoid the seed +
	// unrelated shapes). Used by the `unoverlap` pattern.
	const movingIds = new Set(items.filter((i) => i.kind === "existing").map((i) => i.id));
	const occupied: BoundingBox[] = [];
	for (const [id, s] of store.getShapes()) {
		if (!movingIds.has(id)) occupied.push(occupiedAABB(deps, s));
	}

	// Pattern items (intrinsic bounds) + a map back to their source.
	type Source =
		| { kind: "existing"; id: string }
		| { kind: "new"; spec: Extract<(typeof items)[number], { kind: "new" }>["spec"] };
	const patternItems: PatternItem[] = [];
	const sources = new Map<string, Source>();
	items.forEach((it, i) => {
		if (it.kind === "existing") {
			const s = store.getShape(it.id);
			if (!s) return; // stale id — skip
			patternItems.push({ key: it.id, bounds: boundsOf(deps, s) });
			sources.set(it.id, { kind: "existing", id: it.id });
		} else {
			const { width, height } = it.spec;
			if (!(width > 0) || !(height > 0)) {
				throw new Error("[scatter] a new shape spec must carry positive width/height");
			}
			const key = `new:${i}`;
			patternItems.push({ key, bounds: { x: 0, y: 0, width, height } });
			sources.set(key, { kind: "new", spec: it.spec });
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
			const { spec } = src;
			const id = typeof spec.id === "string" ? spec.id : generateId();
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
	const seedId = request.seedId ?? soleSelection(deps);
	if (!seedId) {
		throw new Error("[scatter] no seed: select exactly one shape or pass request.seedId");
	}
	const seedShape = deps.store.getShape(seedId);
	if (!seedShape) throw new Error(`[scatter] seed shape not found: ${seedId}`);

	const plan = planScatter(deps, seedShape, request);
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
