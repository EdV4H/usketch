// @vitest-environment jsdom
// (No type-only import may come first: tsc drops it, and this pragma with it, from
// the dist build CI runs.)
import { createView3dCell } from "@edv4h/usketch-shared";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Canvas } from "../components/canvas.js";
import { AppProvider } from "../context.js";

type AppInstance = Parameters<typeof AppProvider>[0]["app"];

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function stubApp(seen: number[]) {
	const viewport = { x: 0, y: 0, zoom: 2 };
	const shapes = new Map();
	const selection = new Set<string>();
	const sorted: never[] = [];
	const view3d = createView3dCell();
	const layers = [
		{
			id: "ground",
			order: 0,
			view3d: "tilt",
			render: (rc: { view3dOverscan?: number }) => {
				seen.push(rc.view3dOverscan ?? -1);
				return null;
			},
		},
		{ id: "hud", order: 1, fixed: true, render: () => null },
	];
	const app = {
		store: {
			subscribe: () => () => {},
			getViewport: () => viewport,
			getShapes: () => shapes,
			getShapesSorted: () => sorted,
			getSelection: () => selection,
			getHoveredShapeId: () => null,
			getActiveToolId: () => "select",
			getView3d: () => view3d.get(),
			setView3d: (p: Parameters<typeof view3d.set>[0]) => view3d.set(p),
			subscribeView3d: (l: () => void) => view3d.subscribe(l),
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
	return { app, view3d };
}

describe("Canvas and the 3D view", () => {
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
		vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(800);
		vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1280);
		el = document.createElement("div");
		document.body.appendChild(el);
		root = createRoot(el);
	});

	afterEach(() => {
		act(() => root.unmount());
		el.remove();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("marks each layer's wrapper with how it shows in 3D", () => {
		const { app } = stubApp([]);
		act(() =>
			root.render(
				<AppProvider app={app}>
					<Canvas />
				</AppProvider>,
			),
		);
		expect(el.querySelector("[data-layer-id='ground']")?.getAttribute("data-view3d")).toBe("tilt");
		expect(el.querySelector("[data-layer-id='hud']")?.hasAttribute("data-view3d")).toBe(false);
	});

	it("hands layers the overscan the draw distance needs while in 3D", () => {
		const seen: number[] = [];
		const { app, view3d } = stubApp(seen);
		act(() =>
			root.render(
				<AppProvider app={app}>
					<Canvas />
				</AppProvider>,
			),
		);
		expect(seen.at(-1)).toBe(0);
		// 1500 world units × zoom 2 = 3000 px, 2200 past the 800 px stage, plus the buffer.
		act(() => view3d.set({ amount: 1 }));
		expect(seen.at(-1)).toBe(2216);
		// The camera height moving doesn't re-render the layers.
		const renders = seen.length;
		act(() => view3d.set({ camera: { height: 40 } }));
		expect(seen.length).toBe(renders);
	});
});
