import {
	createEventBus,
	createSelectionHandleRegistry,
	createShapeRegistry,
} from "@edv4h/usketch-core";
import type {
	CanvasPointerEvent,
	Command,
	PluginContext,
	SelectionHandle,
	SelectionHandleDrag,
	SelectionHandleProvider,
	ShapeData,
	ToolContext,
	ToolDefinition,
} from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSelectToolPlugin } from "../plugin.js";
import { collectHandles, findHandleAt } from "../selection-handles.js";

/** Just enough `document` for the tool's cursor <style> and selectstart guard. */
function stubDocument() {
	const style = { dataset: {}, textContent: "", remove() {} };
	vi.stubGlobal("document", {
		createElement: () => style,
		head: { appendChild() {} },
		addEventListener() {},
		removeEventListener() {},
	});
	return style;
}

const rect = (id: string, x: number, y: number, zIndex: string): ShapeData =>
	({ id, type: "rect", x, y, width: 100, height: 100, rotation: 0, zIndex }) as ShapeData;

function setup() {
	const cursorStyle = stubDocument();
	const store = createBoardStore();
	store.addShape(rect("a", 0, 0, "a0"));
	store.addShape(rect("b", 300, 0, "a1"));
	store.setActiveToolId("select");
	const shapes = createShapeRegistry();
	shapes.register("rect", {
		render: () => null,
		getBounds: (s: ShapeData) => ({ x: s.x, y: s.y, width: s.width, height: s.height }),
		hitTest: (s: ShapeData, p: { x: number; y: number }) =>
			p.x >= s.x && p.x <= s.x + s.width && p.y >= s.y && p.y <= s.y + s.height,
		resize: (s: ShapeData, _h: string, d: { x: number; y: number }) => ({
			...s,
			width: s.width + d.x,
			height: s.height + d.y,
		}),
		move: (s: ShapeData) => s,
		createDefault: (s: Partial<ShapeData>) => s as ShapeData,
	} as never);
	const selectionHandles = createSelectionHandleRegistry();
	const tools = new Map<string, ToolDefinition>();
	const history: Command[] = [];
	const ctx = {
		store,
		shapes,
		events: createEventBus(),
		commands: {
			execute(cmd: Command) {
				cmd.execute();
				history.push(cmd);
			},
		},
		tools: { register: (id: string, def: ToolDefinition) => tools.set(id, def) },
		layers: { register() {}, unregister() {} },
		shortcuts: { register: () => () => {} },
		ui: { registerSelectionForeground: () => () => {}, selectionHandles },
	} as unknown as PluginContext;
	const teardown = createSelectToolPlugin().setup?.(ctx) as () => void;
	const tool = tools.get("select") as ToolDefinition;
	const toolCtx = ctx as unknown as ToolContext;
	const ev = (x: number, y: number, extra: Partial<CanvasPointerEvent> = {}) =>
		({
			worldPoint: { x, y },
			screenPoint: { x, y },
			button: 0,
			shiftKey: false,
			ctrlKey: false,
			metaKey: false,
			altKey: false,
			...extra,
		}) as CanvasPointerEvent;
	const down = (x: number, y: number, extra?: Partial<CanvasPointerEvent>) =>
		tool.onPointerDown?.(toolCtx, ev(x, y, extra));
	const move = (x: number, y: number) => tool.onPointerMove?.(toolCtx, ev(x, y));
	const up = (x: number, y: number, extra?: Partial<CanvasPointerEvent>) =>
		tool.onPointerUp?.(toolCtx, ev(x, y, extra));
	return { store, ctx, selectionHandles, cursorStyle, down, move, up, teardown, history };
}

/** A provider with one fixed handle on shape `b`, recording its drag calls. */
function provider(handle: Partial<SelectionHandle> = {}, opts: { moves?: boolean } = {}) {
	const calls: string[] = [];
	const h: SelectionHandle = {
		id: "h",
		point: { x: 300, y: 150 },
		cursor: "crosshair",
		shapeId: "b",
		...handle,
	};
	const drag: SelectionHandleDrag = {
		cursor: "grabbing",
		move: () => calls.push("move"),
		end: () => {
			calls.push("end");
			return opts.moves ?? true;
		},
		cancel: () => calls.push("cancel"),
	};
	const p: SelectionHandleProvider = {
		id: "test",
		getHandles: () => [h],
		startDrag: () => {
			calls.push("start");
			return drag;
		},
		render: () => null,
	};
	return { p, calls };
}

let t: ReturnType<typeof setup>;
beforeEach(() => {
	t = setup();
});
afterEach(() => {
	t.teardown();
	vi.unstubAllGlobals();
});

describe("selection handles from other plugins", () => {
	it("押すとその提供元のドラッグが始まり、図形は動かない", () => {
		const { p, calls } = provider();
		t.selectionHandles.register(p);
		t.down(300, 150);
		expect(t.cursorStyle.textContent).toContain("grabbing");
		t.move(320, 170);
		t.up(320, 170);
		expect(calls).toEqual(["start", "move", "end"]);
		expect(t.store.getShape("b")?.x).toBe(300);
		expect(t.cursorStyle.textContent).toBe("");
	});

	it("ホバーでハンドルのカーソルにし、ハンドルの図形をホバー中のままにする", () => {
		t.selectionHandles.register(provider().p);
		t.move(300, 150);
		expect(t.cursorStyle.textContent).toContain("crosshair");
		expect(t.store.getHoveredShapeId()).toBe("b");
	});

	it("何もしなかった押下は、ハンドルの図形をクリックしたことにする", () => {
		t.selectionHandles.register(provider({}, { moves: false }).p);
		t.down(300, 150);
		t.up(300, 150);
		expect([...t.store.getSelection()]).toEqual(["b"]);
		t.store.setSelection(["a"]);
		t.down(300, 150, { shiftKey: true });
		t.up(300, 150, { shiftKey: true });
		expect([...t.store.getSelection()].sort()).toEqual(["a", "b"]);
	});

	it("選択枠のリサイズハンドルに重なるハンドルは出さず、押下はリサイズに渡す", () => {
		t.store.setSelection(["a"]);
		// On a's bottom-right resize handle.
		const { p, calls } = provider({ point: { x: 100, y: 100 }, shapeId: "a" });
		t.selectionHandles.register(p);
		const ctx = { store: t.store, shapes: t.ctx.shapes };
		expect(collectHandles(t.selectionHandles, ctx, t.store.getViewport())[0]?.handles).toEqual([]);
		expect(findHandleAt(t.selectionHandles, ctx, { x: 100, y: 100 })).toBeNull();
		t.down(100, 100);
		// The built-in resize took the press.
		expect(t.cursorStyle.textContent).toContain("resize");
		t.move(140, 140);
		t.up(140, 140);
		expect(calls).toEqual([]);
	});

	it("優先度の高い提供元のハンドルが先に当たる", () => {
		const low = provider();
		const high = provider();
		t.selectionHandles.register(low.p);
		t.selectionHandles.register({ ...high.p, id: "high", priority: 10 });
		expect(findHandleAt(t.selectionHandles, t.ctx, { x: 300, y: 150 })?.provider.id).toBe("high");
	});

	it("select 以外のツールではハンドルを出さない", () => {
		t.selectionHandles.register(provider().p);
		t.store.setActiveToolId("rect");
		expect(collectHandles(t.selectionHandles, t.ctx, t.store.getViewport())).toEqual([]);
	});

	it("ツールが外れると進行中のドラッグを取り消す", () => {
		const { p, calls } = provider();
		t.selectionHandles.register(p);
		t.down(300, 150);
		t.teardown();
		expect(calls).toEqual(["start", "cancel"]);
		// afterEach tears down again: that must be harmless.
	});
});
