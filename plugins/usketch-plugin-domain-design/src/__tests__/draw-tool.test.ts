import type { CanvasPointerEvent, ShapeData, ToolContext } from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import { createDomainConnectorDrawTool } from "../connectors/draw-tool.js";
import { DOMAIN_TYPES } from "../types.js";

function createCtx() {
	const shapes = new Map<string, ShapeData>();
	const ctx = {
		shapes: {
			get: vi.fn(() => ({
				hitTest: (data: ShapeData, point: { x: number; y: number }) =>
					point.x >= data.x &&
					point.x <= data.x + data.width &&
					point.y >= data.y &&
					point.y <= data.y + data.height,
			})),
		},
		store: {
			getShapes: () => shapes as ReadonlyMap<string, ShapeData>,
			getShape: (id: string) => shapes.get(id),
			addShape: vi.fn((shape: ShapeData) => {
				shapes.set(shape.id, shape);
			}),
			updateShape: vi.fn((id: string, patch: Partial<ShapeData>) => {
				const cur = shapes.get(id);
				if (cur) shapes.set(id, { ...cur, ...patch } as ShapeData);
			}),
			deleteShape: vi.fn((id: string) => {
				shapes.delete(id);
			}),
			setActiveToolId: vi.fn(),
			resetToDefaultTool: vi.fn(),
		},
		commands: {
			execute: vi.fn(),
		},
	} as unknown as ToolContext;
	return { ctx, shapes };
}

const event = (x: number, y: number): CanvasPointerEvent =>
	({ worldPoint: { x, y } }) as unknown as CanvasPointerEvent;

describe("createDomainConnectorDrawTool", () => {
	it("does not create a connector when pointerDown misses any shape", () => {
		const { ctx } = createCtx();
		const tool = createDomainConnectorDrawTool(() => ({
			domainKind: "context-map",
			relation: "customer-supplier",
		}));
		tool.onPointerDown(ctx, event(50, 50)); // empty canvas — no source
		expect(tool.isActive()).toBe(false);
		expect(ctx.store.addShape).not.toHaveBeenCalled();
	});

	it("creates a domain-connector with meta when source/target shapes exist", () => {
		const { ctx, shapes } = createCtx();
		const source: ShapeData = {
			id: "s1",
			type: "rect",
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			zIndex: "a0",
			createdAt: 0,
			updatedAt: 0,
			style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
		};
		const target: ShapeData = {
			id: "s2",
			type: "rect",
			x: 200,
			y: 0,
			width: 100,
			height: 100,
			zIndex: "a1",
			createdAt: 0,
			updatedAt: 0,
			style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
		};
		shapes.set(source.id, source);
		shapes.set(target.id, target);

		const tool = createDomainConnectorDrawTool(() => ({
			domainKind: "tactical",
			relation: "composition",
		}));

		tool.onPointerDown(ctx, event(50, 50)); // hits source
		expect(tool.isActive()).toBe(true);

		tool.onPointerMove(ctx, event(250, 50)); // tracking target
		tool.onPointerUp(ctx, event(250, 50)); // commits

		expect(tool.isActive()).toBe(false);
		expect(ctx.commands.execute).toHaveBeenCalledTimes(1);
		// commands.execute is called with a Command object; we don't have direct access to
		// the inner shape unless we run apply. The simpler signal is that addShape was called
		// during pointerDown:
		expect(ctx.store.addShape).toHaveBeenCalled();
	});

	it("rejects self-loop: source and target on the same shape are discarded", () => {
		const { ctx, shapes } = createCtx();
		const single: ShapeData = {
			id: "s1",
			type: "rect",
			x: 0,
			y: 0,
			width: 200,
			height: 200,
			zIndex: "a0",
			createdAt: 0,
			updatedAt: 0,
			style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
		};
		shapes.set(single.id, single);

		const tool = createDomainConnectorDrawTool(() => ({
			domainKind: "context-map",
			relation: "customer-supplier",
		}));

		tool.onPointerDown(ctx, event(50, 50));
		tool.onPointerMove(ctx, event(150, 150));
		tool.onPointerUp(ctx, event(150, 150)); // same shape — discarded

		expect(ctx.commands.execute).not.toHaveBeenCalled();
		expect(ctx.store.deleteShape).toHaveBeenCalled();
	});

	it("emits the configured domainKind / relation in the staged connector meta", () => {
		const { ctx, shapes } = createCtx();
		const source: ShapeData = {
			id: "s1",
			type: "rect",
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			zIndex: "a0",
			createdAt: 0,
			updatedAt: 0,
			style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
		};
		shapes.set(source.id, source);

		const tool = createDomainConnectorDrawTool(() => ({
			domainKind: "tactical",
			relation: "composition",
		}));
		tool.onPointerDown(ctx, event(50, 50));

		// Staged shape was added with meta.domainKind === "tactical"
		const staged = [...shapes.values()].find((s) => s.type === DOMAIN_TYPES.connector);
		expect(staged).toBeDefined();
		expect((staged?.meta as { domainKind?: string; relation?: string }).domainKind).toBe(
			"tactical",
		);
		expect((staged?.meta as { domainKind?: string; relation?: string }).relation).toBe(
			"composition",
		);
	});
});
