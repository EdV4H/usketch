import type {
	CanvasPointerEvent,
	Command,
	SelectionHandle,
	SelectionHandleProvider,
	ShapeData,
	ToolContext,
} from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import { createAnchorHandleProvider } from "./anchor-handles.js";
import { resolveConnectorEnds } from "./connector-ends.js";
import { createEndpointHandleProvider } from "./endpoint-handles.js";
import { createConnectorHandleStore } from "./handle-state.js";
import type { ConnectorShapeData } from "./types.js";

const rect = (id: string, x: number, y: number, zIndex: string): ShapeData =>
	({ id, type: "rect", x, y, width: 100, height: 100, rotation: 0, zIndex }) as ShapeData;

/** a (0,0) and b (300,0) joined by connector k; c (300,300) is free. */
function setup() {
	const store = createBoardStore();
	const a = rect("a", 0, 0, "a0");
	const b = rect("b", 300, 0, "a1");
	const c = rect("c", 300, 300, "a2");
	for (const s of [a, b, c]) store.addShape(s);
	store.addShape({
		id: "k",
		type: "connector",
		rotation: 0,
		zIndex: "a3",
		style: {},
		...resolveConnectorEnds(
			{ shape: a, anchor: "auto", point: { x: 50, y: 50 } },
			{ shape: b, anchor: "auto", point: { x: 350, y: 50 } },
		),
	} as unknown as ConnectorShapeData);
	const history: Command[] = [];
	const ctx = {
		store,
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
	} as unknown as ToolContext;
	const at = (x: number, y: number) =>
		({ worldPoint: { x, y }, screenPoint: { x, y } }) as CanvasPointerEvent;
	const state = createConnectorHandleStore();
	const handles = (provider: SelectionHandleProvider) =>
		provider.getHandles({
			store,
			shapes: ctx.shapes,
			selection: store.getSelection(),
			hoveredShapeId: store.getHoveredShapeId(),
		});
	const connectors = () =>
		[...store.getShapes().values()].filter((s) => s.type === "connector") as ConnectorShapeData[];
	return { store, ctx, at, state, history, handles, connectors };
}

type Setup = ReturnType<typeof setup>;

function endpoints(t: Setup) {
	return createEndpointHandleProvider({ id: "ends", freeEnds: false, state: t.state });
}

function anchors(t: Setup, mode: "hover" | "single" | "selection" = "single") {
	return createAnchorHandleProvider({ id: "anchors", mode, freeEnds: false, state: t.state });
}

const byId = (hs: SelectionHandle[], id: string) => hs.find((h) => h.id === id) as SelectionHandle;
const connector = (t: Setup) => t.store.getShape("k") as ConnectorShapeData;

describe("end handles", () => {
	it("コネクタを 1 本だけ選んでいるときに両端を出す", () => {
		const t = setup();
		const p = endpoints(t);
		expect(t.handles(p)).toEqual([]);
		t.store.setSelection(["k"]);
		const hs = t.handles(p);
		expect(hs.map((h) => h.id)).toEqual(["source", "target"]);
		expect(byId(hs, "target").point).toEqual(connector(t).targetPoint);
		t.store.setSelection(["k", "a"]);
		expect(t.handles(p)).toEqual([]);
	});

	it("曲線のときは制御点も出す", () => {
		const t = setup();
		t.store.updateShape("k", { pathType: "curve" } as Partial<ConnectorShapeData>);
		t.store.setSelection(["k"]);
		expect(t.handles(endpoints(t)).map((h) => h.id)).toEqual(["source", "target", "controlPoint"]);
	});

	it("端をほかの図形の上で離すとつなぎ替え、1 回の undo にまとまる", () => {
		const t = setup();
		t.store.setSelection(["k"]);
		const p = endpoints(t);
		const handle = byId(t.handles(p), "target");
		const drag = p.startDrag(handle, t.at(handle.point.x, handle.point.y), t.ctx);
		drag?.move(t.at(350, 350));
		expect(t.state.get().endpointDrag?.targetShapeId).toBe("c");
		expect(drag?.end(t.at(350, 350))).toBe(true);
		expect(connector(t).targetId).toBe("c");
		expect(t.history).toHaveLength(1);
		expect(t.state.get().endpointDrag).toBeNull();
	});

	it("動かさずに離したら何も変えず、クリックとして扱わせる", () => {
		const t = setup();
		t.store.setSelection(["k"]);
		const p = endpoints(t);
		const handle = byId(t.handles(p), "target");
		const drag = p.startDrag(handle, t.at(handle.point.x, handle.point.y), t.ctx);
		expect(drag?.end(t.at(handle.point.x, handle.point.y))).toBe(false);
		expect(t.history).toHaveLength(0);
	});

	it("押したまま少し揺れただけなら、制御点を固定せずクリックとして扱わせる", () => {
		const t = setup();
		t.store.updateShape("k", { pathType: "curve" } as Partial<ConnectorShapeData>);
		t.store.setSelection(["k"]);
		const p = endpoints(t);
		const handle = byId(t.handles(p), "controlPoint");
		const { x, y } = handle.point;
		const drag = p.startDrag(handle, t.at(x, y), t.ctx);
		drag?.move(t.at(x + 1, y + 1));
		expect(drag?.end(t.at(x + 1, y + 1))).toBe(false);
		expect(connector(t).controlPoint).toBeUndefined();
		expect(t.history).toHaveLength(0);
	});

	it("何も変わらない場所へ動かして離しても、クリックとは扱わせない", () => {
		const t = setup();
		t.store.setSelection(["k"]);
		const p = endpoints(t);
		const handle = byId(t.handles(p), "target");
		const drag = p.startDrag(handle, t.at(handle.point.x, handle.point.y), t.ctx);
		// Onto the shape at the other end: no change.
		drag?.move(t.at(50, 50));
		expect(drag?.end(t.at(50, 50))).toBe(true);
		expect(connector(t).targetId).toBe("b");
		expect(t.history).toHaveLength(0);
	});

	it("取り消すと、動かした制御点を元に戻す", () => {
		const t = setup();
		t.store.updateShape("k", { pathType: "curve" } as Partial<ConnectorShapeData>);
		t.store.setSelection(["k"]);
		const p = endpoints(t);
		const handle = byId(t.handles(p), "controlPoint");
		const drag = p.startDrag(handle, t.at(handle.point.x, handle.point.y), t.ctx);
		drag?.move(t.at(200, 200));
		expect(connector(t).controlPoint).toEqual({ x: 200, y: 200 });
		drag?.cancel();
		expect(connector(t).controlPoint).toBeUndefined();
		expect(t.history).toHaveLength(0);
		expect(t.state.get().endpointDrag).toBeNull();
	});
});

describe("anchor handles", () => {
	it("選んだ図形とホバー中の図形に 4 辺の丸を出し、コネクタには出さない", () => {
		const t = setup();
		const p = anchors(t);
		t.store.setSelection(["a"]);
		t.store.setHoveredShapeId("c");
		const hs = t.handles(p);
		expect(hs.map((h) => h.id)).toEqual([
			"a:top",
			"a:right",
			"a:bottom",
			"a:left",
			"c:top",
			"c:right",
			"c:bottom",
			"c:left",
		]);
		// Selected shape's dots sit just outside its edge; hovered ones on it.
		expect(byId(hs, "a:top").offset).toEqual({ x: 0, y: -16 });
		expect(byId(hs, "c:top").offset).toBeUndefined();
		t.store.setSelection(["k"]);
		t.store.setHoveredShapeId("k");
		expect(t.handles(p)).toEqual([]);
	});

	it("single では複数選択のときに選択側の丸を出さない", () => {
		const t = setup();
		t.store.setSelection(["a", "b"]);
		expect(t.handles(anchors(t))).toEqual([]);
		expect(t.handles(anchors(t, "selection"))).toHaveLength(8);
	});

	it("丸からドラッグして別の図形で離すとコネクタを 1 本足す", () => {
		const t = setup();
		t.store.setSelection(["c"]);
		const p = anchors(t);
		const handle = byId(t.handles(p), "c:top");
		const drag = p.startDrag(handle, t.at(350, 300), t.ctx);
		drag?.move(t.at(350, 200));
		drag?.move(t.at(350, 50));
		expect(t.state.get().anchorDraw?.targetShapeId).toBe("b");
		expect(drag?.end(t.at(350, 50))).toBe(true);
		const added = t.connectors().find((c) => c.id !== "k");
		expect(added).toMatchObject({ sourceId: "c", sourceAnchor: "top", targetId: "b" });
		expect(t.history).toHaveLength(1);
		expect(t.state.get().anchorDraw).toBeNull();
	});

	it("丸をクリックしただけなら何も足さない", () => {
		const t = setup();
		t.store.setSelection(["c"]);
		const p = anchors(t);
		const handle = byId(t.handles(p), "c:top");
		const drag = p.startDrag(handle, t.at(350, 300), t.ctx);
		drag?.move(t.at(351, 301));
		expect(drag?.end(t.at(351, 301))).toBe(false);
		expect(t.connectors()).toHaveLength(1);
		expect(t.history).toHaveLength(0);
	});

	it("取り消すと描きかけのコネクタを消す", () => {
		const t = setup();
		t.store.setSelection(["c"]);
		const p = anchors(t);
		const drag = p.startDrag(byId(t.handles(p), "c:top"), t.at(350, 300), t.ctx);
		drag?.move(t.at(350, 100));
		expect(t.connectors()).toHaveLength(2);
		drag?.cancel();
		expect(t.connectors()).toHaveLength(1);
		expect(t.history).toHaveLength(0);
	});
});
