import type { PluginContext, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import { CARD_TYPE } from "../factory.js";
import { createHandStore } from "../hand-store.js";
import { type CreateCardPluginOptions, createCardPlugin } from "../plugin.js";
import type { CardTypeDefinition } from "../types.js";

function makeCardType(): CardTypeDefinition {
	return {
		id: "playing-card",
		label: "Playing",
		aspectRatio: 2 / 3,
		defaultSize: { width: 100, height: 150 },
		icon: () => null as never,
		createDefaultFields: () => ({}),
		renderFront: () => null as never,
		renderBack: () => null as never,
		buildDeck: () => [{}, {}],
	};
}

function cardShape(id: string): ShapeData {
	return {
		id,
		type: CARD_TYPE,
		x: 0,
		y: 0,
		width: 100,
		height: 150,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
		meta: { cardType: "playing-card", isFlipped: false, fields: { rank: "A" } },
	} as ShapeData;
}

/** Mock ctx with a spy on `hud.registerPanel` and a working event bus. */
function harness(handOpts: CreateCardPluginOptions["hand"]) {
	const shapes = new Map<string, ShapeData>();
	const handlers = new Map<string, (p: unknown) => void>();
	const registerPanel = vi.fn(() => () => {});
	const noop = () => {};

	const ctx = {
		actions: { register: () => noop },
		events: {
			on: (type: string, cb: (p: unknown) => void) => {
				handlers.set(type, cb);
				return () => handlers.delete(type);
			},
			emit: (type: string, p: unknown) => handlers.get(type)?.(p),
			off: noop,
		},
		transient: { registerType: noop, emit: noop },
		shapes: { register: noop, get: () => undefined },
		tools: { register: noop },
		layers: { register: noop, unregister: noop },
		hud: { registerPanel, registerSettings: () => noop },
		shortcuts: { register: () => noop },
		store: {
			getShape: (id: string) => shapes.get(id),
			getShapes: () => shapes,
			getShapesSorted: () => [...shapes.values()],
			getSelection: () => new Set<string>(),
			addShape: (s: ShapeData) => shapes.set(s.id, s),
			deleteShape: (id: string) => shapes.delete(id),
			updateShape: noop,
			setSelection: noop,
			resetToDefaultTool: noop,
		},
		commands: { execute: (cmd: { execute(): void }) => cmd.execute() },
	} as unknown as PluginContext;

	createCardPlugin({ cardTypes: [makeCardType()], userId: "u1", hand: handOpts }).setup(ctx);

	const emit = (type: string, id: string) => ctx.events.emit(type, { id });
	return { shapes, emit, registerPanel };
}

describe("headless hand (issue #915)", () => {
	it("registers the built-in HUD Hand panel by default", () => {
		const { registerPanel } = harness(undefined);
		expect(registerPanel).toHaveBeenCalledTimes(1);
	});

	it('does not register any built-in hand UI when hand.ui is "none"', () => {
		const { registerPanel } = harness({ ui: "none" });
		expect(registerPanel).not.toHaveBeenCalled();
	});

	it("uses an injected hand store (same instance) — card:to-hand updates it", () => {
		const store = createHandStore("u1");
		const { shapes, emit } = harness({ ui: "none", store });
		shapes.set("c1", cardShape("c1"));

		emit("card:to-hand", "c1");

		// The host's own store instance received the card (subscribe works same-tab).
		expect(store.getHand().map((e) => e.id)).toEqual(["c1"]);
		expect(shapes.has("c1")).toBe(false); // removed from the board
	});

	it("hands the store instance to the host via hand.onStore", () => {
		const store = createHandStore("u1");
		const onStore = vi.fn();
		harness({ ui: "none", store, onStore });
		expect(onStore).toHaveBeenCalledWith(store); // exact same instance
	});
});
