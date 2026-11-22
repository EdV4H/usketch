import {
	createActionRegistry,
	createCommandRegistry,
	createEventBus,
	createServiceRegistry,
	createShapeRegistry,
	createToolRegistry,
} from "@edv4h/usketch-core";
import type {
	CanvasPointerEvent,
	PluginContext,
	ShapeData,
	ToolContext,
} from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import { createTabletopPlugin, ZONE_TOOL_ID } from "../plugin.js";
import { getTabletopApi } from "../service.js";
import { createZoneShape, readZoneMeta, ZONE_TYPE } from "../zone.js";

function harness(opts: Parameters<typeof createTabletopPlugin>[0] = {}) {
	const store = createBoardStore();
	const ctx = {
		store,
		shapes: createShapeRegistry(),
		tools: createToolRegistry(),
		actions: createActionRegistry(),
		commands: createCommandRegistry(),
		services: createServiceRegistry(),
		events: createEventBus(),
	} as unknown as PluginContext;
	const dispose = createTabletopPlugin(opts).setup(ctx) as () => void;
	const api = getTabletopApi(ctx.services);
	if (!api) throw new Error("service not provided");
	return { store, ctx, api, dispose };
}

const shape = (type: string, o: Partial<ShapeData> = {}): ShapeData =>
	({ id: type, type, x: 0, y: 0, width: 10, height: 10, ...o }) as ShapeData;

describe("createTabletopPlugin", () => {
	it("registers the zone as a snug auto-attach container, the tool, actions and the service", () => {
		const { ctx } = harness();
		const container = ctx.shapes.get(ZONE_TYPE)?.container;
		expect(container).toMatchObject({ autoAttach: true, attachHit: "center" });
		expect(ctx.tools.get(ZONE_TOOL_ID)).toBeDefined();
		const ids = ctx.actions.getOrdered().map((a) => a.id);
		expect(ids).toEqual(
			expect.arrayContaining([
				"tabletop-zone:arrange",
				"tabletop-zone:face",
				"tabletop-zone:label",
			]),
		);
	});

	it("does not register the tool when tool is false", () => {
		const { ctx } = harness({ tool: false });
		expect(ctx.tools.get(ZONE_TOOL_ID)).toBeUndefined();
	});

	it("the tool draws one zone at a time, with the primary button only", () => {
		const { ctx, store } = harness();
		const tool = ctx.tools.get(ZONE_TOOL_ID);
		if (!tool?.onPointerDown) throw new Error("no tool");
		const toolCtx = { store } as unknown as ToolContext;
		const down = (button: number, x: number) =>
			tool.onPointerDown?.(toolCtx, { button, worldPoint: { x, y: 0 } } as CanvasPointerEvent);
		const zones = () => store.getShapesSorted().filter((s) => s.type === ZONE_TYPE);

		down(2, 0);
		down(1, 0);
		expect(zones()).toHaveLength(0);

		down(0, 0);
		down(0, 50); // a second pointer while the first draft is out
		expect(zones()).toHaveLength(1);
	});

	it("accepts shapes by the zone's list and the host's filter, never zones or connectors", () => {
		const { ctx } = harness({ accepts: (child) => child.type !== "sticky" });
		const accepts = ctx.shapes.get(ZONE_TYPE)?.container?.accepts;
		if (!accepts) throw new Error("no accepts");
		const any = createZoneShape({ x: 0, y: 0 });
		const cardsOnly = createZoneShape({ x: 0, y: 0, accepts: ["card"] });
		expect(accepts(shape("card"), any)).toBe(true);
		expect(accepts(shape("rect"), any)).toBe(true);
		expect(accepts(shape("rect"), cardsOnly)).toBe(false);
		expect(accepts(shape("sticky"), any)).toBe(false);
		expect(accepts(createZoneShape({ x: 0, y: 0 }), any)).toBe(false);
		// The default filter skips connectors; a host filter replaces it.
		const { ctx: plain } = harness();
		expect(plain.shapes.get(ZONE_TYPE)?.container?.accepts?.(shape("connector"), any)).toBe(false);
	});

	it("the service edits a zone and reports what it holds", () => {
		const { api, store } = harness();
		const zone = api.addZone({ x: 0, y: 0, label: "Deck" });
		store.addShape(shape("card", { id: "c1", parentId: zone.id }));
		store.addShape(shape("card", { id: "c2" }));

		expect(api.setArrange(zone.id, "spread")).toBe(true);
		expect(api.setFace(zone.id, "down")).toBe(true);
		expect(api.setAccepts(zone.id, ["card"])).toBe(true);
		expect(readZoneMeta(store.getShape(zone.id) as ShapeData)).toEqual({
			label: "Deck",
			arrange: "spread",
			face: "down",
			accepts: ["card"],
		});
		expect(api.setArrange("c2", "grid")).toBe(false);
		expect(api.count(zone.id)).toBe(1);
		expect(api.zoneOf("c1")?.id).toBe(zone.id);
		expect(api.zoneOf("c2")).toBeUndefined();
	});

	it("the arrange action sets the selected zone's layout", () => {
		const { ctx, api, store } = harness();
		const zone = api.addZone({ x: 0, y: 0 });
		const action = ctx.actions.get("tabletop-zone:arrange");
		expect(action?.isEnabled?.()).toBe(false);
		store.setSelection([zone.id]);
		expect(action?.isEnabled?.()).toBe(true);
		action?.run({ arrange: "grid" });
		expect(readZoneMeta(store.getShape(zone.id) as ShapeData).arrange).toBe("grid");
	});

	it("teardown removes the service", () => {
		const { ctx, dispose } = harness();
		dispose();
		expect(getTabletopApi(ctx.services)).toBeUndefined();
	});
});
