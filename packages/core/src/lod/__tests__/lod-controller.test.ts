import type { LodPolicy, RenderMode } from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import { createLodController } from "../lod-controller.js";
import { createZoomLodPolicy } from "../policies.js";

function fixedPolicy(mode: RenderMode): LodPolicy {
	return { id: "fixed", evaluate: () => mode };
}

describe("createLodController", () => {
	it("starts in initialMode (default interactive)", () => {
		const c = createLodController({ policy: createZoomLodPolicy() });
		expect(c.getMode()).toBe("interactive");
	});

	it("respects initialMode option", () => {
		const c = createLodController({ policy: createZoomLodPolicy(), initialMode: "lod" });
		expect(c.getMode()).toBe("lod");
	});

	it("tick() applies the policy decision", () => {
		const c = createLodController({ policy: fixedPolicy("lod") });
		c.tick({
			viewport: { x: 0, y: 0, zoom: 1 },
			shapeCount: 0,
			fps: 60,
			currentMode: c.getMode(),
		});
		expect(c.getMode()).toBe("lod");
	});

	it("notifies listeners only on actual mode change", () => {
		const c = createLodController({ policy: fixedPolicy("lod") });
		const listener = vi.fn();
		c.onModeChange(listener);
		c.tick({
			viewport: { x: 0, y: 0, zoom: 1 },
			shapeCount: 0,
			fps: 60,
			currentMode: c.getMode(),
		});
		expect(listener).toHaveBeenCalledTimes(1);
		expect(listener).toHaveBeenCalledWith("lod");
		// Same mode again — no notification
		c.tick({
			viewport: { x: 0, y: 0, zoom: 1 },
			shapeCount: 0,
			fps: 60,
			currentMode: c.getMode(),
		});
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("setManualOverride pins the mode and ignores tick", () => {
		const c = createLodController({ policy: fixedPolicy("lod") });
		c.setManualOverride("interactive");
		expect(c.getMode()).toBe("interactive");
		c.tick({
			viewport: { x: 0, y: 0, zoom: 1 },
			shapeCount: 0,
			fps: 60,
			currentMode: c.getMode(),
		});
		expect(c.getMode()).toBe("interactive");
	});

	it("releasing manual override allows tick to drive mode again", () => {
		const c = createLodController({ policy: fixedPolicy("lod") });
		c.setManualOverride("interactive");
		c.setManualOverride(null);
		c.tick({
			viewport: { x: 0, y: 0, zoom: 1 },
			shapeCount: 0,
			fps: 60,
			currentMode: c.getMode(),
		});
		expect(c.getMode()).toBe("lod");
	});

	it("setPolicy swaps the active policy", () => {
		const c = createLodController({ policy: fixedPolicy("interactive") });
		c.setPolicy(fixedPolicy("lod"));
		c.tick({
			viewport: { x: 0, y: 0, zoom: 1 },
			shapeCount: 0,
			fps: 60,
			currentMode: c.getMode(),
		});
		expect(c.getMode()).toBe("lod");
	});

	it("unsubscribe stops notifications", () => {
		const c = createLodController({ policy: fixedPolicy("lod") });
		const listener = vi.fn();
		const unsub = c.onModeChange(listener);
		unsub();
		c.tick({
			viewport: { x: 0, y: 0, zoom: 1 },
			shapeCount: 0,
			fps: 60,
			currentMode: c.getMode(),
		});
		expect(listener).not.toHaveBeenCalled();
	});
});
