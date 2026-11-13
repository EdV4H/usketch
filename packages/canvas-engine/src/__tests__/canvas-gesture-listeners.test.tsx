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

/** An app whose viewport really changes (zoomTo / setViewport notify subscribers). */
function stubApp() {
	let viewport = { x: 0, y: 0, zoom: 1 };
	const listeners = new Set<() => void>();
	const notify = () => {
		for (const l of listeners) l();
	};
	const shapes = new Map();
	const selection = new Set<string>();
	const sorted: never[] = [];
	const layers = [{ id: "shapes", zIndex: 0, render: () => null }];
	const emitted: { event: string; data: unknown }[] = [];
	const app = {
		store: {
			subscribe: (l: () => void) => {
				listeners.add(l);
				return () => listeners.delete(l);
			},
			getViewport: () => viewport,
			getShapes: () => shapes,
			getShapesSorted: () => sorted,
			getSelection: () => selection,
			getHoveredShapeId: () => null,
			getActiveToolId: () => "select",
			zoomTo: (zoom: number) => {
				viewport = { ...viewport, zoom };
				notify();
			},
		},
		events: {
			on: () => () => {},
			emit: (event: string, data: unknown) => emitted.push({ event, data }),
		},
		tools: { get: () => undefined },
		lod: { getMode: () => "dom", onModeChange: () => () => {}, tick: () => {} },
		layers: { getLayers: () => layers, register: () => {}, unregister: () => {} },
		selectionForeground: { getActive: () => null, subscribe: () => () => {} },
		externalContent: { dispatch: async () => {} },
		shapes: {},
		commands: {},
	};
	return {
		app: app as unknown as AppInstance,
		emitted,
		setViewport(next: { x: number; y: number; zoom: number }) {
			viewport = next;
			notify();
		},
	};
}

/** A Safari `gesture*` event (`scale` is cumulative from gesturestart). */
function gesture(type: string, scale: number): Event {
	return Object.assign(new Event(type, { cancelable: true }), { scale, clientX: 0, clientY: 0 });
}

describe("Canvas wheel / gesture listeners", () => {
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

	function mount(app: AppInstance): HTMLDivElement {
		act(() =>
			root.render(
				<AppProvider app={app}>
					<Canvas />
				</AppProvider>,
			),
		);
		const container = el.querySelector<HTMLDivElement>("[data-testid='canvas-container']");
		if (!container) throw new Error("no canvas container");
		return container;
	}

	// `scale` is cumulative, so the zoom after a pinch must equal the last scale. The
	// zoom each step applies re-renders the canvas; that must not reset the
	// previous-scale tracking (which made the pinch zoom by the running product).
	it("zooms a Safari pinch by the gesture's final scale across re-renders", () => {
		const { app } = stubApp();
		const container = mount(app);

		act(() => container.dispatchEvent(gesture("gesturestart", 1)));
		for (const scale of [1.1, 1.2, 1.3]) {
			act(() => container.dispatchEvent(gesture("gesturechange", scale)));
		}

		expect(app.store.getViewport().zoom).toBeCloseTo(1.3, 6);
	});

	it("does not re-attach the listeners when the viewport changes", () => {
		const stub = stubApp();
		const container = mount(stub.app);
		const add = vi.spyOn(container, "addEventListener");

		for (let i = 1; i <= 10; i++) {
			act(() => stub.setViewport({ x: i * 10, y: 0, zoom: 1 }));
		}

		const attached = add.mock.calls.map(([type]) => type);
		expect(attached.filter((t) => t === "wheel" || t.startsWith("gesture"))).toEqual([]);
	});

	it("reports the wheel's world point with the current viewport", () => {
		const stub = stubApp();
		const container = mount(stub.app);
		act(() => stub.setViewport({ x: 100, y: 50, zoom: 2 }));

		act(() => {
			container.dispatchEvent(
				new WheelEvent("wheel", { clientX: 300, clientY: 250, deltaY: 10, cancelable: true }),
			);
		});

		const wheel = stub.emitted.find((e) => e.event === "canvas:wheel")?.data as
			| { worldPoint: { x: number; y: number } }
			| undefined;
		expect(wheel?.worldPoint).toEqual({ x: 100, y: 100 });
	});
});
