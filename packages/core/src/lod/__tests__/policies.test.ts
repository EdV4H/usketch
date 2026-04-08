import type { LodPolicyContext, RenderMode } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import {
	createCompositeLodPolicy,
	createFpsLodPolicy,
	createShapeCountLodPolicy,
	createZoomLodPolicy,
} from "../policies.js";

function ctx(overrides: Partial<LodPolicyContext> = {}): LodPolicyContext {
	return {
		viewport: { x: 0, y: 0, zoom: 1 },
		shapeCount: 0,
		fps: 60,
		currentMode: "interactive",
		...overrides,
	};
}

describe("createZoomLodPolicy", () => {
	const policy = createZoomLodPolicy({ enterAt: 0.5, exitAt: 0.7 });

	it("enters lod when zoom drops below enterAt", () => {
		expect(policy.evaluate(ctx({ viewport: { x: 0, y: 0, zoom: 0.4 } }))).toBe("lod");
	});

	it("stays interactive when zoom is above enterAt", () => {
		expect(policy.evaluate(ctx({ viewport: { x: 0, y: 0, zoom: 0.6 } }))).toBe("interactive");
	});

	it("hysteresis: stays in lod between exitAt and enterAt", () => {
		expect(policy.evaluate(ctx({ viewport: { x: 0, y: 0, zoom: 0.6 }, currentMode: "lod" }))).toBe(
			"lod",
		);
	});

	it("exits lod when zoom rises above exitAt", () => {
		expect(policy.evaluate(ctx({ viewport: { x: 0, y: 0, zoom: 0.8 }, currentMode: "lod" }))).toBe(
			"interactive",
		);
	});
});

describe("createShapeCountLodPolicy", () => {
	const policy = createShapeCountLodPolicy({ enterAt: 1000, exitAt: 800 });

	it("enters lod above enterAt", () => {
		expect(policy.evaluate(ctx({ shapeCount: 1500 }))).toBe("lod");
	});

	it("hysteresis: stays in lod between exitAt and enterAt", () => {
		expect(policy.evaluate(ctx({ shapeCount: 900, currentMode: "lod" }))).toBe("lod");
	});

	it("exits below exitAt", () => {
		expect(policy.evaluate(ctx({ shapeCount: 700, currentMode: "lod" }))).toBe("interactive");
	});
});

describe("createFpsLodPolicy", () => {
	const policy = createFpsLodPolicy({ enterAt: 30, exitAt: 50 });

	it("enters lod when fps drops below enterAt", () => {
		expect(policy.evaluate(ctx({ fps: 25 }))).toBe("lod");
	});

	it("hysteresis", () => {
		expect(policy.evaluate(ctx({ fps: 40, currentMode: "lod" }))).toBe("lod");
	});

	it("exits when fps recovers above exitAt", () => {
		expect(policy.evaluate(ctx({ fps: 55, currentMode: "lod" }))).toBe("interactive");
	});
});

describe("createCompositeLodPolicy", () => {
	it("returns lod if any child returns lod", () => {
		const composite = createCompositeLodPolicy([
			createZoomLodPolicy({ enterAt: 0.5, exitAt: 0.7 }),
			createShapeCountLodPolicy({ enterAt: 1000, exitAt: 800 }),
		]);
		expect(composite.evaluate(ctx({ shapeCount: 1500 }))).toBe("lod");
		expect(composite.evaluate(ctx({ viewport: { x: 0, y: 0, zoom: 0.3 } }))).toBe("lod");
	});

	it("returns interactive if all children return interactive", () => {
		const composite = createCompositeLodPolicy([
			createZoomLodPolicy(),
			createShapeCountLodPolicy(),
		]);
		expect(composite.evaluate(ctx())).toBe("interactive");
	});

	it("preserves gpu-only if a child returns it and no child requests lod", () => {
		const gpuOnly = { id: "gpu", evaluate: (): RenderMode => "gpu-only" };
		const composite = createCompositeLodPolicy([gpuOnly, createZoomLodPolicy()]);
		expect(composite.evaluate(ctx())).toBe("gpu-only");
	});
});
