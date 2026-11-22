import type {
	BoardStore,
	Command,
	CommandRegistry,
	ShapeData,
	ShapeRegistry,
} from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { scatter } from "../engine.js";
import type { PatternContext, ScatterDeps } from "../types.js";

function makeEnv(initial: Partial<ShapeData>[]) {
	const shapes = new Map<string, ShapeData>(initial.map((s) => [s.id as string, s as ShapeData]));
	let selection = new Set<string>();
	let last: Command | null = null;
	const store = {
		getShapes: () => shapes,
		getShape: (id: string) => shapes.get(id),
		addShape: (s: ShapeData) => shapes.set(s.id, s),
		updateShape: (id: string, patch: Partial<ShapeData>) => {
			const s = shapes.get(id);
			if (s) shapes.set(id, { ...s, ...patch });
		},
		deleteShape: (id: string) => shapes.delete(id),
		getSelection: () => selection,
		setSelection: (ids: Iterable<string>) => {
			selection = new Set(ids);
		},
	} as unknown as BoardStore;
	const registry = {
		get: (type: string) => ({
			// "wide" mimics freedraw/connector: getBounds reaches past the stored box.
			getBounds: (s: ShapeData) =>
				type === "wide"
					? { x: s.x - 100, y: s.y, width: s.width + 100, height: s.height }
					: { x: s.x, y: s.y, width: s.width, height: s.height },
			createDefault: ({ id, x, y }: { id: string; x: number; y: number }) => ({
				id,
				type,
				x,
				y,
				width: 0,
				height: 0,
				style: {},
			}),
		}),
	} as unknown as ShapeRegistry;
	const commands = {
		execute: (c: Command) => {
			last = c;
			c.execute();
		},
	} as unknown as CommandRegistry;
	const deps: ScatterDeps = { store, shapes: registry, commands };
	return { shapes, store, deps, getLast: () => last };
}

const rect = (id: string, x: number, y: number, extra: Partial<ShapeData> = {}) =>
	({ id, type: "rect", x, y, width: 40, height: 40, style: {}, ...extra }) as Partial<ShapeData>;

describe("scatter() — existing shapes", () => {
	it("moves the seed's related shapes as one command", async () => {
		const env = makeEnv([
			rect("seed", 500, 500),
			rect("a", 500, 500, { parentId: "seed" }),
			rect("b", 500, 500, { parentId: "seed" }),
		]);
		const before = { ...(env.shapes.get("a") as ShapeData) };
		const res = await scatter(env.deps, {
			seedId: "seed",
			relation: "children",
			pattern: "grid",
			spacing: 20,
			seed: 1,
			animate: false,
		});
		expect(res.movedIds.sort()).toEqual(["a", "b"]);
		expect(res.createdIds).toEqual([]);
		const after = env.shapes.get("a") as ShapeData;
		expect(after.x !== before.x || after.y !== before.y).toBe(true); // actually moved
		expect(env.getLast()).not.toBeNull(); // exactly one command executed
	});

	it("returns empty and does nothing when the seed has no related shapes", async () => {
		const env = makeEnv([rect("seed", 0, 0)]);
		const res = await scatter(env.deps, {
			seedId: "seed",
			relation: "children",
			pattern: "grid",
			animate: false,
		});
		expect(res).toEqual({ movedIds: [], createdIds: [] });
		expect(env.getLast()).toBeNull();
	});
});

describe("scatter() — new + mixed", () => {
	it("spawns new shapes via createDefault and places them", async () => {
		const env = makeEnv([rect("seed", 500, 500)]);
		const res = await scatter(env.deps, {
			seedId: "seed",
			items: [
				{ kind: "new", spec: { type: "note", width: 60, height: 30 } },
				{ kind: "new", spec: { type: "note", width: 60, height: 30 } },
			],
			pattern: "grid",
			spacing: 10,
			seed: 7,
			animate: false,
		});
		expect(res.createdIds).toHaveLength(2);
		expect(env.shapes.size).toBe(3); // seed + 2 spawned
		for (const id of res.createdIds) {
			const s = env.shapes.get(id) as ShapeData;
			expect(s.type).toBe("note");
			expect(s.width).toBe(60);
			expect(s.height).toBe(30);
		}
	});

	it("handles a mixed existing ∪ new set", async () => {
		const env = makeEnv([rect("seed", 500, 500), rect("a", 500, 500)]);
		const res = await scatter(env.deps, {
			seedId: "seed",
			items: [
				{ kind: "existing", id: "a" },
				{ kind: "new", spec: { type: "rect", width: 40, height: 40 } },
			],
			pattern: "radial",
			seed: 3,
			animate: false,
		});
		expect(res.movedIds).toEqual(["a"]);
		expect(res.createdIds).toHaveLength(1);
	});

	it("throws on a new spec missing width/height", async () => {
		const env = makeEnv([rect("seed", 0, 0)]);
		await expect(
			scatter(env.deps, {
				seedId: "seed",
				items: [{ kind: "new", spec: { type: "rect", width: 0, height: 40 } }],
				pattern: "grid",
				animate: false,
			}),
		).rejects.toThrow();
	});

	it("throws when a new spec id collides with an existing shape (never overwrites)", async () => {
		const env = makeEnv([rect("seed", 0, 0), rect("dup", 10, 10)]);
		await expect(
			scatter(env.deps, {
				seedId: "seed",
				items: [{ kind: "new", spec: { id: "dup", type: "rect", width: 40, height: 40 } }],
				pattern: "grid",
				animate: false,
			}),
		).rejects.toThrow();
		expect(env.shapes.get("dup")).toMatchObject({ x: 10, y: 10 }); // untouched
	});
});

describe("scatter() — origin (seed point)", () => {
	const note = { kind: "new", spec: { type: "note", width: 20, height: 20 } } as const;

	it("scatters around a bare point with no seed shape", async () => {
		const env = makeEnv([]);
		let seen: PatternContext | null = null;
		const res = await scatter(env.deps, {
			origin: { point: { x: 100, y: 200 }, radius: 50 },
			items: [note, note],
			pattern: (ctx) => {
				seen = ctx;
				return ctx.items.map((it) => ({ key: it.key, x: ctx.seedCenter.x, y: ctx.seedCenter.y }));
			},
			animate: false,
		});
		expect(res.createdIds).toHaveLength(2);
		expect(env.shapes.size).toBe(2);
		const ctx = seen as unknown as PatternContext;
		expect(ctx.seedCenter).toEqual({ x: 100, y: 200 });
		expect(ctx.seedBounds).toEqual({ x: 50, y: 150, width: 100, height: 100 });
	});

	it("uses a zero-size seed box when radius is omitted", async () => {
		const env = makeEnv([]);
		let bounds: unknown = null;
		await scatter(env.deps, {
			origin: { point: { x: 10, y: 20 } },
			items: [note],
			pattern: (ctx) => {
				bounds = ctx.seedBounds;
				return [];
			},
			animate: false,
		});
		expect(bounds).toEqual({ x: 10, y: 20, width: 0, height: 0 });
	});

	it("prefers seedId over origin, and origin over the selection", async () => {
		const env = makeEnv([rect("seed", 0, 0), rect("sel", 1000, 1000)]);
		env.store.setSelection(["sel"]);
		const centers: unknown[] = [];
		const pattern = (ctx: PatternContext) => {
			centers.push(ctx.seedCenter);
			return [];
		};
		await scatter(env.deps, {
			seedId: "seed",
			origin: { point: { x: 500, y: 500 } },
			items: [note],
			pattern,
		});
		await scatter(env.deps, { origin: { point: { x: 500, y: 500 } }, items: [note], pattern });
		expect(centers).toEqual([
			{ x: 20, y: 20 },
			{ x: 500, y: 500 },
		]);
	});

	it("rejects a relation without a seed shape", async () => {
		const env = makeEnv([]);
		await expect(
			scatter(env.deps, {
				origin: { point: { x: 0, y: 0 } },
				relation: "children",
				pattern: "grid",
			}),
		).rejects.toThrow(/relation needs a seed shape/);
	});

	it("treats a null / empty seedId as not given", async () => {
		const env = makeEnv([rect("sel", 1000, 1000)]);
		env.store.setSelection(["sel"]);
		const centers: unknown[] = [];
		const pattern = (ctx: PatternContext) => {
			centers.push(ctx.seedCenter);
			return [];
		};
		const origin = { point: { x: 5, y: 6 } };
		await scatter(env.deps, { seedId: null as unknown as string, origin, items: [note], pattern });
		await scatter(env.deps, { seedId: "", origin, items: [note], pattern });
		expect(centers).toEqual([
			{ x: 5, y: 6 },
			{ x: 5, y: 6 },
		]);
	});

	it("rejects a non-finite or negative origin radius", async () => {
		const env = makeEnv([]);
		for (const radius of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
			await expect(
				scatter(env.deps, {
					origin: { point: { x: 0, y: 0 }, radius },
					items: [note],
					pattern: "grid",
				}),
			).rejects.toThrow(/radius/);
		}
	});

	it("rejects a non-finite origin point", async () => {
		const env = makeEnv([]);
		await expect(
			scatter(env.deps, {
				origin: { point: { x: Number.NaN, y: 0 } },
				items: [note],
				pattern: "grid",
			}),
		).rejects.toThrow(/finite/);
	});
});

describe("scatter() — occupiedIn / occupiedFilter", () => {
	const note = { kind: "new", spec: { type: "note", width: 20, height: 20 } } as const;
	const captureOccupied = async (
		env: ReturnType<typeof makeEnv>,
		extra: Partial<Parameters<typeof scatter>[1]>,
	) => {
		let occupied: unknown = null;
		await scatter(env.deps, {
			origin: { point: { x: 0, y: 0 } },
			items: [note],
			pattern: (ctx) => {
				occupied = ctx.occupied;
				return [];
			},
			...extra,
		});
		return occupied as { x: number; y: number }[];
	};

	it("defaults to every shape on the board", async () => {
		const env = makeEnv([rect("near", 0, 0), rect("far", 5000, 5000)]);
		const occ = await captureOccupied(env, {});
		expect(occ).toHaveLength(2);
	});

	it("limits occupied to shapes intersecting occupiedIn", async () => {
		const env = makeEnv([rect("near", 0, 0), rect("far", 5000, 5000)]);
		const occ = await captureOccupied(env, {
			occupiedIn: { x: -100, y: -100, width: 200, height: 200 },
		});
		expect(occ).toEqual([{ x: 0, y: 0, width: 40, height: 40 }]);
	});

	it("uses getBounds (not the stored box) to test occupiedIn", async () => {
		// Stored box starts at x=150 (outside the area); getBounds reaches back to x=50.
		const env = makeEnv([rect("stroke", 150, 0, { type: "wide" })]);
		const occ = await captureOccupied(env, {
			occupiedIn: { x: -100, y: -100, width: 200, height: 200 },
		});
		expect(occ).toEqual([{ x: 50, y: 0, width: 140, height: 40 }]);
	});

	it("rejects a non-finite or negative occupiedIn", async () => {
		const env = makeEnv([]);
		await expect(
			captureOccupied(env, {
				occupiedIn: { x: Number.NEGATIVE_INFINITY, y: 0, width: 10, height: 10 },
			}),
		).rejects.toThrow(/occupiedIn/);
		await expect(
			captureOccupied(env, { occupiedIn: { x: 0, y: 0, width: -1, height: 10 } }),
		).rejects.toThrow(/occupiedIn/);
	});

	it("drops shapes rejected by occupiedFilter", async () => {
		const env = makeEnv([rect("note", 0, 0), rect("frame", 0, 0, { type: "frame" })]);
		const occ = await captureOccupied(env, { occupiedFilter: (s) => s.type !== "frame" });
		expect(occ).toHaveLength(1);
	});

	it("still excludes moving items from occupied", async () => {
		const env = makeEnv([rect("seed", 0, 0), rect("a", 10, 10, { parentId: "seed" })]);
		let occupied: unknown[] = [];
		await scatter(env.deps, {
			seedId: "seed",
			relation: "children",
			occupiedIn: { x: -100, y: -100, width: 200, height: 200 },
			pattern: (ctx) => {
				occupied = ctx.occupied;
				return [];
			},
		});
		expect(occupied).toEqual([{ x: 0, y: 0, width: 40, height: 40 }]);
	});
});
