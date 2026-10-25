import type {
	CanvasPointerEvent,
	Command,
	PluginContext,
	Point,
	ShapeData,
	ToolContext,
	ToolDefinition,
} from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { beforeEach, describe, expect, it } from "vitest";
import { createConnectorPlugin } from "./plugin.js";
import type { ConnectorShapeData } from "./types.js";

/** Minimal plugin host: a real BoardStore plus registries that just record. */
function setup(freeEnds = true) {
	const store = createBoardStore();
	const defs = new Map<string, { hitTest(d: ShapeData, p: Point): boolean; container?: object }>();
	const inBounds = (d: ShapeData, p: Point) =>
		p.x >= d.x && p.x <= d.x + d.width && p.y >= d.y && p.y <= d.y + d.height;
	defs.set("rectangle", { hitTest: inBounds });
	defs.set("frame", { hitTest: inBounds, container: {} });
	const tools = new Map<string, ToolDefinition>();
	const history: Command[] = [];
	const commands = {
		execute(cmd: Command) {
			cmd.execute();
			history.push(cmd);
		},
		undo() {
			history.pop()?.undo();
		},
	};
	const noop = () => () => {};
	const ctx = {
		store,
		shapes: {
			register: (type: string, def: { hitTest(d: ShapeData, p: Point): boolean }) =>
				defs.set(type, def),
			get: (type: string) => defs.get(type),
		},
		tools: { register: (id: string, def: ToolDefinition) => tools.set(id, def) },
		layers: { register: () => {}, unregister: () => {} },
		events: { on: noop, emit: () => {} },
		actions: { register: noop },
		commands,
	} as unknown as PluginContext;
	createConnectorPlugin({
		endpoints: false,
		labelEditor: false,
		anchorHandles: false,
		freeEnds,
	}).setup?.(ctx);
	const tool = tools.get("connector-draw") as ToolDefinition;
	const toolCtx = ctx as unknown as ToolContext;
	const ev = (x: number, y: number) =>
		({ worldPoint: { x, y }, screenPoint: { x, y }, button: 0 }) as CanvasPointerEvent;
	const drag = (from: Point, to: Point) => {
		tool.onPointerDown?.(toolCtx, ev(from.x, from.y));
		tool.onPointerMove?.(toolCtx, ev(to.x, to.y));
		tool.onPointerUp?.(toolCtx, ev(to.x, to.y));
	};
	const connectors = () =>
		[...store.getShapes().values()].filter((s) => s.type === "connector") as ConnectorShapeData[];
	return { store, commands, drag, connectors };
}

function rect(id: string, x: number, y: number): ShapeData {
	return {
		id,
		type: "rectangle",
		x,
		y,
		width: 100,
		height: 60,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
	};
}

function frame(id: string, x: number, y: number, width: number, height: number): ShapeData {
	return { ...rect(id, x, y), type: "frame", width, height };
}

describe("connector-draw tool", () => {
	let h: ReturnType<typeof setup>;
	beforeEach(() => {
		h = setup();
		// a: (0,0)-(100,60), b: (300,0)-(400,60)
		h.store.addShape(rect("a", 0, 0));
		h.store.addShape(rect("b", 300, 0));
	});

	it("connects shape to shape", () => {
		h.drag({ x: 50, y: 30 }, { x: 350, y: 30 });
		const [c] = h.connectors();
		expect(c).toMatchObject({ sourceId: "a", targetId: "b" });
		expect(c?.sourcePoint).toEqual({ x: 100, y: 30 });
		expect(c?.targetPoint).toEqual({ x: 300, y: 30 });
	});

	it("draws a free arrow on empty canvas", () => {
		h.drag({ x: 0, y: 200 }, { x: 150, y: 250 });
		const [c] = h.connectors();
		expect(c?.sourceId).toBeUndefined();
		expect(c?.targetId).toBeUndefined();
		expect(c?.sourcePoint).toEqual({ x: 0, y: 200 });
		expect(c?.targetPoint).toEqual({ x: 150, y: 250 });
	});

	it("connects only the source when released on empty space", () => {
		h.drag({ x: 50, y: 30 }, { x: 200, y: 30 });
		const [c] = h.connectors();
		expect(c?.sourceId).toBe("a");
		expect(c?.targetId).toBeUndefined();
		expect(c?.sourcePoint).toEqual({ x: 100, y: 30 });
		expect(c?.targetPoint).toEqual({ x: 200, y: 30 });
	});

	it("connects only the target when started on empty space", () => {
		h.drag({ x: 200, y: 30 }, { x: 350, y: 30 });
		const [c] = h.connectors();
		expect(c?.sourceId).toBeUndefined();
		expect(c?.targetId).toBe("b");
		expect(c?.sourcePoint).toEqual({ x: 200, y: 30 });
		expect(c?.targetPoint).toEqual({ x: 300, y: 30 });
	});

	it("discards a click (drag under 4 screen px)", () => {
		h.drag({ x: 200, y: 200 }, { x: 202, y: 201 });
		expect(h.connectors()).toHaveLength(0);
	});

	it("discards a drag that starts and ends on the same shape", () => {
		h.drag({ x: 10, y: 10 }, { x: 90, y: 50 });
		expect(h.connectors()).toHaveLength(0);
	});

	it("is a single undo step", () => {
		h.drag({ x: 0, y: 200 }, { x: 150, y: 250 });
		expect(h.connectors()).toHaveLength(1);
		h.commands.undo();
		expect(h.connectors()).toHaveLength(0);
	});
});

describe("connector-draw tool inside a frame (freeEnds)", () => {
	let h: ReturnType<typeof setup>;
	beforeEach(() => {
		h = setup();
		// f: (0,0)-(600,400) with child a: (50,50)-(150,110)
		h.store.addShape(frame("f", 0, 0, 600, 400));
		h.store.addShape({ ...rect("a", 50, 50), parentId: "f" });
	});

	it("treats the inside of a frame as empty space", () => {
		h.drag({ x: 300, y: 200 }, { x: 450, y: 300 });
		const [c] = h.connectors();
		expect(c?.sourceId).toBeUndefined();
		expect(c?.targetId).toBeUndefined();
	});

	it("leaves the end free when dragging from a child to the frame's empty area", () => {
		h.drag({ x: 100, y: 80 }, { x: 400, y: 300 });
		const [c] = h.connectors();
		expect(c?.sourceId).toBe("a");
		expect(c?.targetId).toBeUndefined();
		expect(c?.targetPoint).toEqual({ x: 400, y: 300 });
	});

	it("connects to the frame when released on its edge", () => {
		h.drag({ x: 100, y: 80 }, { x: 597, y: 300 });
		const [c] = h.connectors();
		expect(c).toMatchObject({ sourceId: "a", targetId: "f" });
	});
});

describe("connector-draw tool without freeEnds", () => {
	let h: ReturnType<typeof setup>;
	beforeEach(() => {
		h = setup(false);
		h.store.addShape(rect("a", 0, 0));
		h.store.addShape(rect("b", 300, 0));
	});

	it("connects shape to shape", () => {
		h.drag({ x: 50, y: 30 }, { x: 350, y: 30 });
		expect(h.connectors()[0]).toMatchObject({ sourceId: "a", targetId: "b" });
	});

	it("does not start on empty canvas", () => {
		h.drag({ x: 0, y: 200 }, { x: 150, y: 250 });
		expect(h.connectors()).toHaveLength(0);
	});

	it("discards a drag released on empty space", () => {
		h.drag({ x: 50, y: 30 }, { x: 200, y: 30 });
		expect(h.connectors()).toHaveLength(0);
	});
});

describe("connector-draw preview", () => {
	it("adds nothing to the store for a click on empty canvas", () => {
		const h = setup();
		const added: string[] = [];
		h.store.onMutation((e) => {
			if (e.type === "shape:added") added.push(e.type);
		});
		h.drag({ x: 200, y: 200 }, { x: 201, y: 200 });
		expect(added).toHaveLength(0);
	});
});
