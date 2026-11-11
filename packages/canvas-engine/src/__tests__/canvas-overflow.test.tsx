// @vitest-environment jsdom
// (No type-only import may come first: tsc drops it, and this pragma with it, from
// the dist build CI runs.)
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Canvas } from "../components/canvas.js";
import { AppProvider } from "../context.js";

type AppInstance = Parameters<typeof AppProvider>[0]["app"];

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Just enough of an app for <Canvas> to mount with one ordinary (non-fixed) layer. */
function stubApp(): AppInstance {
	const viewport = { x: 0, y: 0, zoom: 1 };
	// Snapshots must be stable references (useSyncExternalStore).
	const shapes = new Map();
	const selection = new Set<string>();
	const sorted: never[] = [];
	const layers = [{ id: "shapes", zIndex: 0, render: () => null }];
	return {
		store: {
			subscribe: () => () => {},
			getViewport: () => viewport,
			getShapes: () => shapes,
			getShapesSorted: () => sorted,
			getSelection: () => selection,
			getHoveredShapeId: () => null,
			getActiveToolId: () => "select",
		},
		events: { on: () => () => {}, emit: () => {} },
		tools: { get: () => undefined },
		lod: { getMode: () => "dom", onModeChange: () => () => {}, tick: () => {} },
		layers: { getLayers: () => layers, register: () => {}, unregister: () => {} },
		selectionForeground: { getActive: () => null, subscribe: () => () => {} },
		externalContent: { dispatch: async () => {} },
		shapes: {},
		commands: {},
	} as unknown as AppInstance;
}

describe("Canvas overflow", () => {
	let el: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		vi.stubGlobal(
			"ResizeObserver",
			class {
				observe() {}
				disconnect() {}
			},
		);
		el = document.createElement("div");
		document.body.appendChild(el);
		root = createRoot(el);
	});

	afterEach(() => {
		act(() => root.unmount());
		el.remove();
		vi.unstubAllGlobals();
	});

	// `hidden` boxes can still be scrolled by the browser (e.g. focusing a textarea
	// near the edge), which shifts the drawing away from hit-testing. `clip` can't.
	it("clips (not hides) the container and layer frames so focus can't scroll them", () => {
		act(() =>
			root.render(
				<AppProvider app={stubApp()}>
					<Canvas />
				</AppProvider>,
			),
		);

		const container = el.querySelector<HTMLDivElement>("[data-testid='canvas-container']");
		const layer = el.querySelector<HTMLDivElement>("[data-layer-id='shapes']");
		expect(container?.style.overflow).toBe("clip");
		expect(layer?.style.overflow).toBe("clip");
	});
});
