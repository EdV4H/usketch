import { createEventBus, createShapeRegistry } from "@edv4h/usketch-core";
import type { Layer, PluginContext } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSelectToolPlugin } from "../plugin.js";
import {
	createOutline3dSettings,
	polygonPoints,
	SELECTION_OUTLINE_3D_LAYER_ID,
	visibleRuns,
} from "../selection-outline-3d.js";

// The plugin's setup adds a cursor <style> and a few listeners; stand in for the DOM.
const noop = () => {};
const fakeDom = () => {
	vi.stubGlobal("document", {
		createElement: () => ({ dataset: {}, remove: noop, textContent: "" }),
		head: { appendChild: noop },
		addEventListener: noop,
		removeEventListener: noop,
	});
	vi.stubGlobal("window", { addEventListener: noop, removeEventListener: noop });
};

describe("the select tool in a 3D view", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("draws the outline corners as an SVG points list", () => {
		expect(
			polygonPoints([
				{ x: 1, y: 2 },
				{ x: 3.04, y: 4 },
				{ x: 5, y: 6.06 },
			]),
		).toBe("1,2 3,4 5,6.1");
	});

	it("draws the part the ground hides dashed by default, or leaves it out", () => {
		const settings = createOutline3dSettings();
		expect(settings.getSnapshot()).toBe("dashed");
		let n = 0;
		settings.subscribe(() => n++);
		settings.set("hidden");
		settings.set("hidden");
		settings.set("bogus" as never);
		settings.set(undefined);
		expect(settings.getSnapshot()).toBe("hidden");
		expect(n).toBe(1);
		expect(createOutline3dSettings("hidden").getSnapshot()).toBe("hidden");

		const p = { x: 0, y: 0 };
		const runs = [
			{ points: [p, p], hidden: false, closed: false },
			{ points: [p, p], hidden: true, closed: false },
		];
		expect(visibleRuns(runs, "dashed")).toHaveLength(2);
		expect(visibleRuns(runs, "hidden")).toEqual([runs[0]]);
	});

	it("outlines the selection on an untilted layer, removed on teardown", () => {
		fakeDom();
		const layers = new Map<string, Layer>();
		const ctx = {
			store: createBoardStore(),
			shapes: createShapeRegistry(),
			events: createEventBus(),
			commands: { execute() {} },
			tools: { register() {} },
			layers: {
				register: (l: Layer) => layers.set(l.id, l),
				unregister: (id: string) => layers.delete(id),
			},
			shortcuts: { register: () => () => {} },
			ui: { registerSelectionForeground: () => () => {} },
		} as unknown as PluginContext;
		const teardown = createSelectToolPlugin().setup?.(ctx) as () => void;
		expect(layers.get(SELECTION_OUTLINE_3D_LAYER_ID)).toMatchObject({
			view3d: "screen",
			fixed: true,
		});
		teardown();
		expect(layers.has(SELECTION_OUTLINE_3D_LAYER_ID)).toBe(false);
	});
});
