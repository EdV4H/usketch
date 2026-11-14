import type { ShapeData, ShapeRegistry } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import {
	COMPARE3D_ID_PREFIX,
	compare3dShapes,
	formatCompare3dResult,
	frameStats,
	otherRendererSearch,
	readCompare3dScene,
} from "../compare-3d.js";

const registry = {
	get: (type: string) =>
		["sticky", "text", "image", "rectangle", "ellipse"].includes(type)
			? {
					createDefault: ({ id, x, y }: { id: string; x: number; y: number }) =>
						({ id, type, x, y, width: 100, height: 100, style: {} }) as unknown as ShapeData,
				}
			: undefined,
} as unknown as ShapeRegistry;

describe("readCompare3dScene", () => {
	it("reads only the known scenes", () => {
		expect(readCompare3dScene("?scene3d=hills&renderer3d=gpu")).toBe("hills");
		expect(readCompare3dScene("?scene3d=drive")).toBe("drive");
		expect(readCompare3dScene("?scene3d=map")).toBeNull();
		expect(readCompare3dScene("")).toBeNull();
	});
});

describe("compare3dShapes", () => {
	it("builds the same scene every time, with the planned counts", () => {
		const hills = compare3dShapes("hills", registry);
		expect(hills).toEqual(compare3dShapes("hills", registry));
		expect(hills.every((s) => s.id.startsWith(COMPARE3D_ID_PREFIX))).toBe(true);
		const solid = (list: ShapeData[]) => list.filter((s) => (s as { view3d?: unknown }).view3d);
		expect(solid(hills)).toHaveLength(30);
		expect(hills).toHaveLength(50);
		const many = compare3dShapes("many", registry);
		expect(solid(many)).toHaveLength(50);
		expect(many).toHaveLength(350);
		expect(new Set(many.map((s) => s.id)).size).toBe(350);
	});

	it("leaves out types the board doesn't have", () => {
		const onlySticky = {
			get: (t: string) => (t === "sticky" ? registry.get("sticky") : undefined),
		} as unknown as ShapeRegistry;
		expect(compare3dShapes("many", onlySticky).every((s) => s.type === "sticky")).toBe(true);
	});
});

describe("frameStats", () => {
	it("summarises frame gaps", () => {
		const s = frameStats([10, 20, 30, 40, Number.NaN, -1, ...Array(16).fill(16)]);
		expect(s.frames).toBe(20);
		expect(s.p50).toBe(16);
		expect(s.max).toBe(40);
		expect(s.p95).toBe(40);
		expect(frameStats([])).toEqual({ frames: 0, p50: 0, p95: 0, max: 0, fps: 0 });
	});

	it("formats a result for pasting", () => {
		const f = frameStats([16, 17]);
		const text = formatCompare3dResult({
			scene: "many",
			renderer: "gpu",
			userAgent: "UA",
			move: f,
			transition: { ...f, ms: 900 },
			drag: f,
		});
		expect(text.split("\n")[0]).toBe("[gpu] many");
		expect(text).toContain("遷移: 900 ms");
	});
});

describe("otherRendererSearch", () => {
	it("flips the renderer and keeps the rest", () => {
		expect(otherRendererSearch("?scene3d=hills", "css")).toBe("?scene3d=hills&renderer3d=gpu");
		expect(otherRendererSearch("?scene3d=hills&renderer3d=gpu", "gpu")).toBe("?scene3d=hills");
	});
});
