import { DEFAULT_STYLE, type ShapeData, type ShapeRegistry } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { canvasToPrompt } from "../canvas-serializer.js";

/**
 * Build a minimal shape with default style and given overrides.
 */
function makeShape(overrides: Partial<ShapeData> & { id: string; type: string }): ShapeData {
	return {
		id: overrides.id,
		type: overrides.type,
		x: overrides.x ?? 0,
		y: overrides.y ?? 0,
		width: overrides.width ?? 100,
		height: overrides.height ?? 100,
		style: overrides.style ?? { ...DEFAULT_STYLE },
		...(overrides.rotation !== undefined ? { rotation: overrides.rotation } : {}),
	} as ShapeData;
}

/**
 * Make a registry whose `get(type)` returns a stub `ShapeDefinition` exposing
 * only the serialization hooks we care about. Other ShapeDefinition fields
 * aren't used by `canvasToPrompt`, so we cast through unknown to keep the
 * fixture compact.
 */
function makeRegistry(
	defs: Record<string, { serializeForAi?: (shape: ShapeData) => Record<string, unknown> }>,
): ShapeRegistry {
	const map = new Map(
		Object.entries(defs).map(([type, def]) => [
			type,
			def as unknown as ReturnType<ShapeRegistry["get"]>,
		]),
	);
	return {
		register: () => {},
		get: (type: string) => map.get(type),
		getAll: () => map as unknown as ReturnType<ShapeRegistry["getAll"]>,
	};
}

const VIEWPORT = { x: 0, y: 0, zoom: 1 };

describe("canvasToPrompt", () => {
	it("emits core fields only when the shape's plugin has no serializeForAi", () => {
		const shape = makeShape({ id: "a", type: "freedraw", x: 5, y: 10, width: 20, height: 30 });
		const shapes = new Map([[shape.id, shape]]);
		const registry = makeRegistry({ freedraw: {} });

		const out = JSON.parse(canvasToPrompt(shapes, VIEWPORT, ["freedraw"], registry));
		expect(out.existingShapes).toHaveLength(1);
		expect(out.existingShapes[0]).toMatchObject({
			id: "a",
			type: "freedraw",
			x: 5,
			y: 10,
			w: 20,
			h: 30,
		});
		// No extra keys merged in.
		expect(Object.keys(out.existingShapes[0]).sort()).toEqual(["h", "id", "type", "w", "x", "y"]);
	});

	it("merges `serializeForAi` extras with core fields", () => {
		const shape = makeShape({ id: "t1", type: "text", width: 200, height: 28 });
		const shapes = new Map([[shape.id, shape]]);
		const registry = makeRegistry({
			text: {
				serializeForAi: () => ({ text: "hello", fontSize: 16 }),
			},
		});

		const out = JSON.parse(canvasToPrompt(shapes, VIEWPORT, ["text"], registry));
		expect(out.existingShapes[0]).toMatchObject({ text: "hello", fontSize: 16 });
	});

	it("drops empty/null/undefined extras but keeps zeros", () => {
		const shape = makeShape({ id: "r1", type: "rect" });
		const shapes = new Map([[shape.id, shape]]);
		const registry = makeRegistry({
			rect: {
				serializeForAi: () => ({
					cornerRadius: 0,
					nullField: null,
					undefField: undefined,
					emptyText: "",
					realText: "x",
				}),
			},
		});

		const out = JSON.parse(canvasToPrompt(shapes, VIEWPORT, ["rect"], registry));
		const serialized = out.existingShapes[0];
		expect(serialized.cornerRadius).toBe(0); // zero kept
		expect(serialized.realText).toBe("x");
		expect(serialized).not.toHaveProperty("nullField");
		expect(serialized).not.toHaveProperty("undefField");
		expect(serialized).not.toHaveProperty("emptyText");
	});

	it("uses `serializeForAi.text` (label convention) for nearby-label lookup", () => {
		const target = makeShape({ id: "rect", type: "rect", x: 0, y: 0, width: 100, height: 100 });
		// Text shape inside rect's bounds — should be picked up as a nearby label.
		const label = makeShape({ id: "l1", type: "text", x: 10, y: 10, width: 50, height: 20 });
		const shapes = new Map([
			[target.id, target],
			[label.id, label],
		]);
		const registry = makeRegistry({
			rect: {},
			text: { serializeForAi: () => ({ text: "Login" }) },
		});

		const selectedIds = new Set(["rect"]);
		const out = JSON.parse(
			canvasToPrompt(shapes, VIEWPORT, ["rect", "text"], registry, selectedIds),
		);
		expect(out.selectedShapes[0].nearbyLabels).toEqual([{ id: "l1", text: "Login" }]);
	});

	it("ignores non-text/sticky shape types when collecting nearby labels", () => {
		const target = makeShape({ id: "rect", type: "rect", x: 0, y: 0, width: 100, height: 100 });
		// Even if a freedraw plugin returned text in serializeForAi, it shouldn't
		// be treated as a label — the type-name filter in ai-agent gates on
		// "text" / "sticky" only.
		const stray = makeShape({ id: "f1", type: "freedraw", x: 10, y: 10, width: 10, height: 10 });
		const shapes = new Map([
			[target.id, target],
			[stray.id, stray],
		]);
		const registry = makeRegistry({
			rect: {},
			freedraw: { serializeForAi: () => ({ text: "scribble", pointCount: 4 }) },
		});

		const out = JSON.parse(
			canvasToPrompt(shapes, VIEWPORT, ["rect", "freedraw"], registry, new Set(["rect"])),
		);
		expect(out.selectedShapes[0].nearbyLabels).toBeUndefined();
	});
});
