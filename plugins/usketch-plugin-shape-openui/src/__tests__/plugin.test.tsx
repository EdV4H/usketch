import type { ShapeData, ShapeRegistry } from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import { createOpenUIShapePlugin } from "../plugin.js";
import type { OpenUIShapeData } from "../types.js";

interface CapturedDefinition {
	render: (data: ShapeData) => unknown;
	getBounds: (data: ShapeData) => unknown;
	hitTest: (data: ShapeData, point: { x: number; y: number }) => boolean;
	resize: (
		data: ShapeData,
		handle: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw",
		delta: { x: number; y: number },
	) => ShapeData;
	createDefault: (params: { id: string; x: number; y: number }) => ShapeData;
	serializeForAi?: (shape: ShapeData) => Record<string, unknown>;
	debugFields?: (shape: ShapeData) => Record<string, unknown>;
}

function setupPlugin(): CapturedDefinition {
	let captured: CapturedDefinition | undefined;
	const shapes = {
		register: vi.fn((_type: string, def: CapturedDefinition) => {
			captured = def;
		}),
	} as unknown as ShapeRegistry;
	createOpenUIShapePlugin().setup({ shapes } as never);
	if (!captured) throw new Error("ShapeDefinition was not registered");
	return captured;
}

describe("createOpenUIShapePlugin", () => {
	it("registers the `openui` shape", () => {
		const shapes = { register: vi.fn() } as unknown as ShapeRegistry;
		createOpenUIShapePlugin().setup({ shapes } as never);
		expect(shapes.register).toHaveBeenCalledWith("openui", expect.any(Object));
	});

	it("createDefault produces a valid OpenUIShapeData with empty langSource", () => {
		const def = setupPlugin();
		const shape = def.createDefault({ id: "test-1", x: 10, y: 20 }) as OpenUIShapeData;
		expect(shape).toMatchObject({
			id: "test-1",
			type: "openui",
			x: 10,
			y: 20,
			width: 480,
			height: 360,
			langSource: "",
			prompt: "",
			model: "",
			libraryId: "openui-default",
		});
	});

	it("getBounds returns the shape rectangle", () => {
		const def = setupPlugin();
		const shape = def.createDefault({ id: "t", x: 5, y: 7 });
		expect(def.getBounds(shape)).toEqual({ x: 5, y: 7, width: 480, height: 360 });
	});

	it("hitTest is true inside, false outside", () => {
		const def = setupPlugin();
		const shape = def.createDefault({ id: "t", x: 0, y: 0 });
		expect(def.hitTest(shape, { x: 100, y: 100 })).toBe(true);
		expect(def.hitTest(shape, { x: 1000, y: 1000 })).toBe(false);
	});

	it("resize clamps width/height to minSize", () => {
		const def = setupPlugin();
		const shape = def.createDefault({ id: "t", x: 0, y: 0 });
		const resized = def.resize(shape, "se", { x: -10000, y: -10000 });
		expect(resized.width).toBeGreaterThanOrEqual(160);
		expect(resized.height).toBeGreaterThanOrEqual(100);
	});

	it("resize handles all eight directions", () => {
		const def = setupPlugin();
		const shape = def.createDefault({ id: "t", x: 0, y: 0 });
		for (const handle of ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const) {
			const r = def.resize(shape, handle, { x: 5, y: 5 });
			expect(r.width).toBeGreaterThanOrEqual(160);
			expect(r.height).toBeGreaterThanOrEqual(100);
		}
	});

	it("serializeForAi omits langSource body but keeps metadata", () => {
		const def = setupPlugin();
		const shape: OpenUIShapeData = {
			...(def.createDefault({ id: "t", x: 0, y: 0 }) as OpenUIShapeData),
			prompt: "a pricing card",
			model: "gpt-4o",
			langSource: "root = Stack()",
		};
		const out = def.serializeForAi?.(shape);
		expect(out).toMatchObject({
			prompt: "a pricing card",
			model: "gpt-4o",
			libraryId: "openui-default",
			langLength: "root = Stack()".length,
		});
		expect(out).not.toHaveProperty("langSource");
	});

	it("debugFields surfaces the same metadata", () => {
		const def = setupPlugin();
		const shape: OpenUIShapeData = {
			...(def.createDefault({ id: "t", x: 0, y: 0 }) as OpenUIShapeData),
			prompt: "p",
			model: "m",
			langSource: "x",
		};
		const out = def.debugFields?.(shape);
		expect(out).toMatchObject({
			prompt: "p",
			model: "m",
			libraryId: "openui-default",
			langLength: 1,
		});
	});
});
