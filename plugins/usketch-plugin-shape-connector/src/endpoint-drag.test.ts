import { createEventBus } from "@edv4h/usketch-core";
import type { CanvasPointerEvent, Command, PluginContext, ShapeData } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { afterEach, describe, expect, it } from "vitest";
import { resolveConnectorEnds } from "./connector-ends.js";
import { startEndpointDrag } from "./endpoint-drag.js";
import { getEndpointDrag } from "./endpoint-drag-state.js";
import type { ConnectorShapeData } from "./types.js";

const rect = (id: string, x: number, y: number): ShapeData =>
	({ id, type: "rect", x, y, width: 100, height: 100, rotation: 0, zIndex: id }) as ShapeData;

/** A fake `window` that records its listeners so a test can fire them. */
function fakeWindow() {
	const listeners = new Map<string, Set<() => void>>();
	return {
		addEventListener: (type: string, fn: () => void) => {
			if (!listeners.has(type)) listeners.set(type, new Set());
			listeners.get(type)?.add(fn);
		},
		removeEventListener: (type: string, fn: () => void) => listeners.get(type)?.delete(fn),
		fire: (type: string) => {
			for (const fn of [...(listeners.get(type) ?? [])]) fn();
		},
		count: () => [...listeners.values()].reduce((n, s) => n + s.size, 0),
	};
}

function setup() {
	const store = createBoardStore();
	const a = rect("a", 0, 0);
	const b = rect("b", 300, 0);
	const c = rect("c", 300, 300);
	for (const s of [a, b, c]) store.addShape(s);
	const connector = {
		id: "k",
		type: "connector",
		rotation: 0,
		zIndex: "k",
		style: {},
		...resolveConnectorEnds(
			{ shape: a, anchor: "auto", point: { x: 50, y: 50 } },
			{ shape: b, anchor: "auto", point: { x: 350, y: 50 } },
		),
	} as unknown as ConnectorShapeData;
	store.addShape(connector);
	const events = createEventBus();
	const history: Command[] = [];
	const ctx = {
		store,
		events,
		shapes: {
			get: () => ({
				hitTest: (s: ShapeData, p: { x: number; y: number }) =>
					p.x >= s.x && p.x <= s.x + s.width && p.y >= s.y && p.y <= s.y + s.height,
			}),
		},
		commands: {
			execute(cmd: Command) {
				cmd.execute();
				history.push(cmd);
			},
		},
	} as unknown as PluginContext;
	const at = (x: number, y: number) =>
		({ worldPoint: { x, y }, screenPoint: { x: x + 999, y: y + 999 } }) as CanvasPointerEvent;
	const win = fakeWindow();
	const drag = () =>
		startEndpointDrag(ctx, {
			connector: store.getShape("k") as ConnectorShapeData,
			endpoint: "target",
			startPoint: (store.getShape("k") as ConnectorShapeData).targetPoint as {
				x: number;
				y: number;
			},
			win,
		});
	return { store, events, history, at, win, drag };
}

const targetId = (store: ReturnType<typeof createBoardStore>) =>
	(store.getShape("k") as ConnectorShapeData).targetId;

afterEach(() => {
	// Each drag ends itself; make sure no test leaks the shared drag state.
	expect(getEndpointDrag()).toBeNull();
});

describe("startEndpointDrag", () => {
	it("キャンバスのイベントの worldPoint で動かし、離した図形につなぎ替える", () => {
		const t = setup();
		t.drag();
		// screenPoint is far off on purpose: only the canvas worldPoint may count.
		t.events.emit("canvas:pointermove", t.at(350, 350));
		expect(getEndpointDrag()?.targetShapeId).toBe("c");
		t.events.emit("canvas:pointerup", t.at(350, 350));
		expect(targetId(t.store)).toBe("c");
		expect(t.history).toHaveLength(1);
		expect(t.win.count()).toBe(0);
	});

	it("キャンバスの外で離したら、最後にキャンバスが伝えた位置で確定する", () => {
		const t = setup();
		t.drag();
		t.events.emit("canvas:pointermove", t.at(350, 350));
		t.win.fire("pointerup");
		expect(targetId(t.store)).toBe("c");
		expect(t.history).toHaveLength(1);
	});

	it("キャンバスと window の両方に pointerup が来ても 1 回だけ確定する", () => {
		const t = setup();
		t.drag();
		t.events.emit("canvas:pointermove", t.at(350, 350));
		t.events.emit("canvas:pointerup", t.at(350, 350));
		t.win.fire("pointerup");
		expect(t.history).toHaveLength(1);
		// Later canvas events no longer move anything.
		t.events.emit("canvas:pointermove", t.at(50, 50));
		expect(getEndpointDrag()).toBeNull();
	});

	it("返した関数で止めると、何も変えずに終わる", () => {
		const t = setup();
		const stop = t.drag();
		t.events.emit("canvas:pointermove", t.at(350, 350));
		stop();
		t.events.emit("canvas:pointerup", t.at(350, 350));
		expect(targetId(t.store)).toBe("b");
		expect(t.history).toHaveLength(0);
	});
});
