import type { ShapeDefinition } from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import { createShapeRegistry } from "../shape-registry.js";

const def = (view3d?: ShapeDefinition["view3d"]): ShapeDefinition =>
	({ view3d }) as unknown as ShapeDefinition;

describe("shape registry: view3d", () => {
	it("answers a type's declared 3D, with the host's overrides merged over it", () => {
		const shapes = createShapeRegistry();
		shapes.register("rect", def({ modes: ["stand", "box", "float"] }));
		expect(shapes.getView3d?.("rect")).toEqual({ modes: ["stand", "box", "float"] });
		expect(shapes.getView3d?.("none")).toBeUndefined();

		const listener = vi.fn();
		shapes.subscribeView3d?.(listener);
		const offA = shapes.configureView3d?.("rect", { default: { mode: "stand" } });
		const offB = shapes.configureView3d?.("rect", { modes: ["stand"] });
		expect(listener).toHaveBeenCalledTimes(2);
		expect(shapes.getView3d?.("rect")).toEqual({ modes: ["stand"], default: { mode: "stand" } });

		offB?.();
		expect(shapes.getView3d?.("rect")).toEqual({
			modes: ["stand", "box", "float"],
			default: { mode: "stand" },
		});
		offA?.();
		offA?.();
		expect(listener).toHaveBeenCalledTimes(4);
		expect(shapes.getView3d?.("rect")).toEqual({ modes: ["stand", "box", "float"] });
	});

	it("keeps an override for a type registered later", () => {
		const shapes = createShapeRegistry();
		shapes.configureView3d?.("portal", { default: { mode: "stand" } });
		expect(shapes.getView3d?.("portal")).toEqual({ default: { mode: "stand" } });
		shapes.register("portal", def({ modes: ["stand"] }));
		expect(shapes.getView3d?.("portal")).toEqual({ modes: ["stand"], default: { mode: "stand" } });
	});
});
