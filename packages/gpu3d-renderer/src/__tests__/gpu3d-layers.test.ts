import { describe, expect, it } from "vitest";
import { splitView3dLayers } from "../gpu3d-layers.js";

describe("splitView3dLayers", () => {
	const layers = [
		{ id: "bg-grid", order: 0, view3d: "tilt" as const },
		{ id: "map-terrain", order: 40, view3d: "tilt" as const },
		{ id: "mesh", order: 46, view3d: "ground" as const },
		{ id: "dom-shapes", order: 50, view3d: "tilt" as const },
		{ id: "handles", order: 81, view3d: "tilt" as const },
		{ id: "late-ground", order: 90, view3d: "ground" as const },
		{ id: "character", order: 700, view3d: "depth" as const },
		{ id: "gpu3d:view", order: 2 },
	];

	it("overlays the 3D layers above the shapes and hides the rest", () => {
		const split = splitView3dLayers(
			layers,
			[
				"bg-grid",
				"map-terrain",
				"dom-shapes",
				"handles",
				"character",
				"character",
				"mesh",
				"late-ground",
				"gpu3d:view",
			],
			"gpu3d:view",
		);
		expect(split.overlay).toEqual(["handles", "character"]);
		expect(split.hidden).toEqual(["bg-grid", "map-terrain", "dom-shapes", "mesh", "late-ground"]);
	});

	it("goes by the highest shape layer, else the DOM renderer's order", () => {
		const withGpu = [...layers, { id: "gpu-shapes", order: 100, view3d: "tilt" as const }];
		expect(splitView3dLayers(withGpu, ["handles", "character"], "x").overlay).toEqual([
			"character",
		]);
		const noShapes = layers.filter((l) => l.id !== "dom-shapes");
		expect(splitView3dLayers(noShapes, ["map-terrain", "handles"], "x")).toEqual({
			hidden: ["map-terrain"],
			overlay: ["handles"],
		});
		// A layer the board doesn't list is hidden.
		expect(splitView3dLayers(layers, ["gone"], "x").hidden).toEqual(["gone"]);
	});
});
