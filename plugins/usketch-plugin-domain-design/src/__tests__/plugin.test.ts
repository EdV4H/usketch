import type { PluginContext, ShapeData, ShapeDefinition } from "@edv4h/usketch-shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { domainDesignPlugin } from "../plugin.js";
import { DOMAIN_TYPES } from "../types.js";

type EventHandler = (data: unknown) => void;

// node 実行環境向けに window を最小モック化（addEventListener / removeEventListener / dispatchEvent）
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
	(globalThis as unknown as { window: typeof win }).window = win;
	return () => {
		(globalThis as unknown as { window: typeof win | undefined }).window = undefined;
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
			updateShape: vi.fn(),
			addShape: vi.fn(),
			deleteShape: vi.fn(),
			setActiveToolId: vi.fn(),
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

describe("domainDesignPlugin", () => {
	let restoreWindow: () => void;
	beforeEach(() => {
		restoreWindow = installWindowMock();
	});
	afterEach(() => {
		restoreWindow();
	});

	it("has stable id and Japanese display name", () => {
		expect(domainDesignPlugin.id).toBe("usketch-plugin-domain-design");
		expect(domainDesignPlugin.name).toBe("ドメイン設計");
	});

	it("registers all 5 domain shape types", async () => {
		const { ctx, shapeRegistrations } = createMockContext();
		await domainDesignPlugin.setup(ctx);
		const types = Array.from(shapeRegistrations.keys()).sort();
		expect(types).toEqual(
			[
				DOMAIN_TYPES.aggregate,
				DOMAIN_TYPES.boundedContext,
				DOMAIN_TYPES.classBox,
				DOMAIN_TYPES.contextMapConnector,
				DOMAIN_TYPES.tacticalConnector,
			].sort(),
		);
		domainDesignPlugin.teardown?.();
	});

	it("registers the domain-draw tool with shortcut 'd'", async () => {
		const { ctx, toolRegistrations } = createMockContext();
		await domainDesignPlugin.setup(ctx);
		const tool = toolRegistrations.get("domain-draw") as { shortcut?: string } | undefined;
		expect(tool).toBeDefined();
		expect(tool?.shortcut).toBe("d");
		domainDesignPlugin.teardown?.();
	});

	it("teardown unregisters listeners (does not throw on second call)", async () => {
		const { ctx } = createMockContext();
		await domainDesignPlugin.setup(ctx);
		expect(() => domainDesignPlugin.teardown?.()).not.toThrow();
		// 2 度目の teardown も安全であること
		expect(() => domainDesignPlugin.teardown?.()).not.toThrow();
	});
});
