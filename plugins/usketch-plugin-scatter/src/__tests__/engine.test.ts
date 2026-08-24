import type {
	BoardStore,
	Command,
	CommandRegistry,
	ShapeData,
	ShapeRegistry,
} from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { scatter } from "../engine.js";
import type { ScatterDeps } from "../types.js";

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
			getBounds: (s: ShapeData) => ({ x: s.x, y: s.y, width: s.width, height: s.height }),
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
