import {
	createBoardHeight,
	createView3dCell,
	projectWorld,
	type ShapeData,
	view3dProjection,
} from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { createView3dPointer } from "../view-3d-pointer.js";

const stage = { width: 800, height: 600 };
const viewport = { x: 400, y: 450, zoom: 1 };

function setup(shapes: ShapeData[] = []) {
	const view3d = createView3dCell();
	const map = new Map(shapes.map((s) => [s.id, s]));
	const store = {
		getViewport: () => viewport,
		getShapes: () => map,
		getShape: (id: string) => map.get(id),
		getShapesSorted: () => shapes,
		getView3d: () => view3d.get(),
		setView3d: (p: Parameters<typeof view3d.set>[0]) => view3d.set(p),
		subscribeView3d: (l: () => void) => view3d.subscribe(l),
	};
	const registry = {
		get: () => ({
			hitTest: (s: ShapeData, p: { x: number; y: number }) =>
				p.x >= s.x && p.x <= s.x + s.width && p.y >= s.y && p.y <= s.y + s.height,
		}),
		getAll: () => new Map(),
		onRegister: () => () => {},
		subscribe: () => () => {},
	};
	const services = { provide: () => () => {}, get: () => undefined, has: () => false };
	const pointer = createView3dPointer({
		store: store as never,
		shapes: registry as never,
		services: services as never,
		events: { on: () => () => {}, emit: () => {} } as never,
		height: createBoardHeight(),
	});
	return { pointer, view3d };
}

const camera = { pitch: 60, fov: 600, horizon: 0.4, height: 40 };

describe("createView3dPointer", () => {
	it("leaves the flat board to the viewport transform", () => {
		const { pointer } = setup();
		expect(pointer.map({ x: 10, y: 10 }, stage, "down", 1, "dom")).toBeNull();
		pointer.dispose();
	});

	it("picks the ground under the pointer in 3D, and a flat shape where it lies", () => {
		const box = { id: "a", type: "box", x: 0, y: -200, width: 100, height: 100 } as ShapeData;
		const { pointer, view3d } = setup([box]);
		view3d.set({ amount: 1, camera });
		const view = view3dProjection(view3d.get(), viewport, stage);
		const s = projectWorld(50, -150, view);
		if (!s) throw new Error("not in view");
		const p = pointer.map({ x: s.x, y: s.y }, stage, "move", 1, "dom");
		expect(p?.x).toBeCloseTo(50, 3);
		expect(p?.y).toBeCloseTo(-150, 3);
		expect(pointer.pick({ x: s.x, y: s.y }, stage, "dom")?.shapeId).toBe("a");
		const g = projectWorld(300, -150, view);
		if (!g) throw new Error("not in view");
		expect(pointer.pick({ x: g.x, y: g.y }, stage, "dom")?.shapeId).toBeNull();
		const corners = pointer.outline("a", stage, "dom");
		const tl = projectWorld(0, -200, view);
		expect(corners?.[0].x).toBeCloseTo(tl?.x ?? Number.NaN, 6);
		expect(corners?.[0].y).toBeCloseTo(tl?.y ?? Number.NaN, 6);
		expect(pointer.outline("missing", stage, "dom")).toBeNull();
		const runs = pointer.outlineRuns("a", stage, "dom");
		expect(runs).toHaveLength(1);
		expect(runs?.[0]).toMatchObject({ hidden: false, closed: true });
		const faces = pointer.facesInView(stage, "dom");
		expect(faces.map((f) => f.shapeId)).toEqual(["a"]);
		const q = faces[0]?.quads[0];
		const round = (v: readonly number[] | undefined) =>
			v?.map((n) => Math.round(n * 1e6) / 1e6 || 0);
		expect([round(q?.at), round(q?.u), round(q?.v)]).toEqual([
			[0, -200, 0],
			[100, 0, 0],
			[0, 100, 0],
		]);
		view3d.set({ amount: 0 });
		expect(pointer.pick({ x: s.x, y: s.y }, stage, "dom")).toBeNull();
		expect(pointer.outline("a", stage, "dom")).toBeNull();
		expect(pointer.outlineRuns("a", stage, "dom")).toBeNull();
		expect(pointer.facesInView(stage, "dom")).toEqual([]);
		pointer.dispose();
	});

	it("keeps a drag on the height and offset it went down at", () => {
		const { pointer, view3d } = setup();
		view3d.set({ amount: 1, camera });
		const view = view3dProjection(view3d.get(), viewport, stage);
		const a = projectWorld(0, -100, view);
		const b = projectWorld(30, -100, view);
		if (!a || !b) throw new Error("not in view");
		const down = pointer.map({ x: a.x, y: a.y }, stage, "down", 7, "dom");
		const move = pointer.map({ x: b.x, y: b.y }, stage, "move", 7, "dom");
		expect(down && move ? move.x - down.x : Number.NaN).toBeCloseTo(30, 3);
		expect(pointer.map({ x: b.x, y: b.y }, stage, "up", 7, "dom")?.x).toBeCloseTo(30, 3);
		pointer.dispose();
	});
});
