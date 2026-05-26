import type { PluginContext, ShapeData, ShapeDefinition } from "@edv4h/usketch-shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDomainDesignPlugin } from "../plugin.js";
import { DOMAIN_TYPES } from "../types.js";

type EventHandler = (data: unknown) => void;

// node 実行環境向けに window を最小モック化（addEventListener / removeEventListener / dispatchEvent）。
// jsdom / happy-dom 環境では既に本物の window が存在するため、元の値を退避して
// teardown で確実に復元する（無条件に undefined にすると後続テストを壊す）。
function installWindowMock() {
	const listeners = new Map<string, Set<EventListener>>();
	const win = {
		addEventListener(type: string, listener: EventListener) {
			const set = listeners.get(type) ?? new Set();
			set.add(listener);
			listeners.set(type, set);
		},
		removeEventListener(type: string, listener: EventListener) {
			listeners.get(type)?.delete(listener);
		},
		dispatchEvent() {
			return true;
		},
	};
	const g = globalThis as unknown as { window?: unknown };
	const hadWindow = "window" in g;
	const previous = g.window;
	g.window = win;
	return () => {
		if (hadWindow) {
			g.window = previous;
		} else {
			delete g.window;
		}
	};
}

function createMockContext() {
	const shapeRegistrations = new Map<string, ShapeDefinition>();
	const toolRegistrations = new Map<string, unknown>();
	const eventHandlers = new Map<string, EventHandler[]>();

	const ctx = {
		shapes: {
			register(type: string, def: ShapeDefinition) {
				shapeRegistrations.set(type, def);
			},
			get(type: string) {
				return shapeRegistrations.get(type);
			},
			getAll() {
				return shapeRegistrations;
			},
		},
		tools: {
			register(id: string, def: unknown) {
				toolRegistrations.set(id, def);
			},
			get(id: string) {
				return toolRegistrations.get(id);
			},
			getAll() {
				return toolRegistrations;
			},
			getOrdered() {
				return [];
			},
		},
		events: {
			on(event: string, handler: EventHandler) {
				const list = eventHandlers.get(event) ?? [];
				list.push(handler);
				eventHandlers.set(event, list);
				return () => {
					const cur = eventHandlers.get(event) ?? [];
					eventHandlers.set(
						event,
						cur.filter((h) => h !== handler),
					);
				};
			},
			emit(event: string, data: unknown) {
				for (const h of eventHandlers.get(event) ?? []) h(data);
			},
		},
		store: {
			getShapes: vi.fn(() => new Map<string, ShapeData>()),
			getShapesSorted: vi.fn(() => [] as ShapeData[]),
			getShape: vi.fn(() => undefined),
			getSelection: vi.fn(() => new Set<string>()),
			subscribe: vi.fn(() => () => {}),
			onMutation: vi.fn(() => () => {}),
			updateShape: vi.fn(),
			addShape: vi.fn(),
			deleteShape: vi.fn(),
			setActiveToolId: vi.fn(),
			resetToDefaultTool: vi.fn(),
		},
		commands: {
			execute: vi.fn(),
		},
		layers: { register: vi.fn(), unregister: vi.fn(), getLayers: () => [] },
		shortcuts: { register: vi.fn(() => () => {}), handleKeyDown: vi.fn() },
		transient: {
			registerType: vi.fn(),
			getRenderer: vi.fn(),
			emit: vi.fn(),
			dismiss: vi.fn(),
			getAll: vi.fn(() => new Map()),
			subscribe: vi.fn(() => () => {}),
		},
		lod: {} as unknown,
	} as unknown as PluginContext;

	return { ctx, shapeRegistrations, toolRegistrations, eventHandlers };
}

describe("createDomainDesignPlugin", () => {
	let restoreWindow: () => void;
	beforeEach(() => {
		restoreWindow = installWindowMock();
	});
	afterEach(() => {
		restoreWindow();
	});

	it("has stable id and Japanese display name", () => {
		const plugin = createDomainDesignPlugin();
		expect(plugin.id).toBe("usketch-plugin-domain-design");
		expect(plugin.name).toBe("ドメイン設計");
	});

	it("registers 4 domain shape types (3 containers + 1 connector)", async () => {
		const { ctx, shapeRegistrations } = createMockContext();
		const plugin = createDomainDesignPlugin();
		const teardown = await plugin.setup(ctx);
		const types = Array.from(shapeRegistrations.keys()).sort();
		expect(types).toEqual(
			[
				DOMAIN_TYPES.aggregate,
				DOMAIN_TYPES.boundedContext,
				DOMAIN_TYPES.classBox,
				DOMAIN_TYPES.connector,
			].sort(),
		);
		teardown?.();
	});

	it("registers a property bar layer for domain-connector", async () => {
		const { ctx } = createMockContext();
		const layerRegister = ctx.layers.register as ReturnType<typeof vi.fn>;
		const plugin = createDomainDesignPlugin();
		const teardown = await plugin.setup(ctx);
		const layerIds = layerRegister.mock.calls.map((call: [{ id: string }]) => call[0].id);
		expect(layerIds).toContain("domain-connector-properties");
		teardown?.();
	});

	it("registers the domain-draw tool with shortcut 'd'", async () => {
		const { ctx, toolRegistrations } = createMockContext();
		const plugin = createDomainDesignPlugin();
		const teardown = await plugin.setup(ctx);
		const tool = toolRegistrations.get("domain-draw") as { shortcut?: string } | undefined;
		expect(tool).toBeDefined();
		expect(tool?.shortcut).toBe("d");
		teardown?.();
	});

	it("teardown unregisters listeners (does not throw on second call)", async () => {
		const { ctx } = createMockContext();
		const plugin = createDomainDesignPlugin();
		const teardown = await plugin.setup(ctx);
		expect(() => teardown?.()).not.toThrow();
		// 2 度目の teardown も安全であること
		expect(() => teardown?.()).not.toThrow();
	});
});
