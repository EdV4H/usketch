import { describe, expect, it, vi } from "vitest";
import { createShape3dSettings } from "../shape-3d-settings.js";

describe("createShape3dSettings", () => {
	it("merges host types over the built-ins and runtime registrations over both", () => {
		const s = createShape3dSettings({ types: { sticky: { modes: [] } } });
		expect(s.get().types.embed?.modes).toEqual([]);
		expect(s.get().types.sticky?.modes).toEqual([]);
		const listener = vi.fn();
		s.subscribe(listener);
		const undo = s.registerType("sticky", { modes: ["stand"] });
		expect(s.get().types.sticky?.modes).toEqual(["stand"]);
		undo();
		expect(s.get().types.sticky?.modes).toEqual([]);
		expect(listener).toHaveBeenCalledTimes(2);
	});
	it("sanitizes limits and skips no-op updates", () => {
		const s = createShape3dSettings({ limits: { maxCount: -1 } });
		expect(s.get().limits.maxCount).toBe(200);
		const listener = vi.fn();
		s.subscribe(listener);
		s.setLimits({ maxCount: 12.7 });
		expect(s.get().limits.maxCount).toBe(12);
		s.setLimits({ maxCount: 12 });
		expect(listener).toHaveBeenCalledTimes(1);
	});
	it("keeps collision on in 2D unless told 3D-only", () => {
		const s = createShape3dSettings({});
		expect(s.get().limits.collisionIn3dOnly).toBe(false);
		s.setLimits({ collisionIn3dOnly: true });
		expect(s.get().limits.collisionIn3dOnly).toBe(true);
		const bad = createShape3dSettings({
			limits: { collisionIn3dOnly: "yes" as unknown as boolean },
		});
		expect(bad.get().limits.collisionIn3dOnly).toBe(false);
	});
});
