import {
	type BoardStore,
	boardHeight,
	type PluginContext,
	shapeSolidsService,
} from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { createApp } from "../create-app.js";

function createStubStore(): BoardStore {
	const listeners = new Set<() => void>();
	return {
		getShapes: () => new Map(),
		getShapesSorted: () => [],
		getShape: () => undefined,
		addShape() {},
		updateShape() {},
		deleteShape() {},
		ensureZIndex() {},
		getSelection: () => new Set(),
		setSelection() {},
		addToSelection() {},
		removeFromSelection() {},
		clearSelection() {},
		getActiveToolId: () => "select",
		setActiveToolId() {},
		getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
		setViewport() {},
		panBy() {},
		zoomTo() {},
		fitToBounds() {},
		getStyleSettings: () => ({ fill: "#ffffff", stroke: "#1e1e1e", strokeWidth: 2, opacity: 1 }),
		setStyleSettings() {},
		getVisibleShapeIds: () => [],
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		onMutation: () => () => {},
	} as unknown as BoardStore;
}

describe("createApp: ctx.height", () => {
	it("hands every plugin the board's height, the same as boardHeight(services)", async () => {
		const seen: PluginContext[] = [];
		const app = await createApp({
			store: createStubStore(),
			plugins: [
				{
					id: "map",
					name: "map",
					setup(ctx) {
						seen.push(ctx);
						return ctx.height?.register({ id: "map", kind: "ground", heightAt: () => 5 });
					},
				},
				{ id: "reader", name: "reader", setup: (ctx) => void seen.push(ctx) },
			],
		});
		expect(seen[0].height).toBe(app.height);
		expect(seen[1].height).toBe(app.height);
		expect(boardHeight(app.services)).toBe(app.height);
		expect(seen[1].height?.groundAt(0, 0)).toBe(5);
		app.destroy();
		expect(app.height.groundAt(0, 0)).toBe(0);
	});

	it("registers the shapes' 3D solids, by the types' declared 3D", async () => {
		const wall = {
			id: "w",
			type: "rect",
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			style: {},
			view3d: { mode: "box", height: 40, collision: "solid" },
		};
		const store = createStubStore();
		(store as unknown as { getShapes: () => Map<string, unknown> }).getShapes = () =>
			new Map([["w", wall]]);
		const app = await createApp({ store, plugins: [] });
		// Undeclared type: box isn't one of its modes.
		expect(app.height.solidAt(50, 50)).toBeNull();
		app.shapes.register("rect", { view3d: { modes: ["box"] } } as never);
		app.shapes.configureView3d?.("rect", { modes: ["box", "stand"] });
		expect(app.height.solidAt(50, 50)).toBe(Infinity);
		expect(shapeSolidsService.get(app.services)).toBeDefined();
		app.destroy();
		expect(app.height.solidAt(50, 50)).toBeNull();
	});
});
