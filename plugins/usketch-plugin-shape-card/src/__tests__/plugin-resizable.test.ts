import type { PluginContext, ShapeData, ShapeDefinition } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { CARD_TYPE, DECK_TYPE } from "../factory.js";
import { type CreateCardPluginOptions, createCardPlugin } from "../plugin.js";
import type { CardTypeDefinition } from "../types.js";

function makeCardType(id: string, resizable?: boolean): CardTypeDefinition {
	return {
		id,
		label: id,
		aspectRatio: 2 / 3,
		defaultSize: { width: 100, height: 150 },
		...(resizable === undefined ? {} : { resizable }),
		icon: () => null as never,
		createDefaultFields: () => ({}),
		renderFront: () => null as never,
		renderBack: () => null as never,
		buildDeck: () => [{}, {}],
	};
}

/**
 * Run the plugin's setup with a minimal mock context and return the
 * ShapeDefinitions it registered (keyed by type).
 */
function registeredDefs(opts: CreateCardPluginOptions): Map<string, ShapeDefinition> {
	const defs = new Map<string, ShapeDefinition>();
	const noop = () => {};
	const off = () => () => {};
	const ctx = {
		events: { on: off, emit: noop, off: noop },
		transient: { registerType: noop, emit: noop },
		shapes: {
			register: (type: string, def: ShapeDefinition) => defs.set(type, def),
			get: () => undefined,
		},
		tools: { register: noop },
		layers: { register: noop, unregister: noop },
		shortcuts: { register: off },
		store: {
			getShape: () => undefined,
			getShapesSorted: () => [],
			getSelection: () => new Set<string>(),
			updateShape: noop,
			addShape: noop,
			deleteShape: noop,
			setSelection: noop,
			resetToDefaultTool: noop,
		},
		commands: { execute: noop },
	} as unknown as PluginContext;

	createCardPlugin(opts).setup(ctx);
	return defs;
}

function cardShape(cardType: string): ShapeData {
	return {
		id: "c1",
		type: CARD_TYPE,
		x: 0,
		y: 0,
		width: 100,
		height: 150,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
		meta: { cardType, isFlipped: false, fields: {} },
	} as ShapeData;
}

function resolve(def: ShapeDefinition | undefined, shape: ShapeData): boolean {
	const r = def?.resizable;
	return typeof r === "function" ? r(shape) : r !== false;
}

describe("createCardPlugin resizable option", () => {
	it("defaults to resizable when nothing is configured", () => {
		const defs = registeredDefs({ cardTypes: [makeCardType("plain")] });
		expect(resolve(defs.get(CARD_TYPE), cardShape("plain"))).toBe(true);
	});

	it("plugin-wide resizable:false makes cards and decks fixed", () => {
		const defs = registeredDefs({ cardTypes: [makeCardType("plain")], resizable: false });
		expect(resolve(defs.get(CARD_TYPE), cardShape("plain"))).toBe(false);
		// decks follow the same resolver
		expect(defs.get(DECK_TYPE)).toBeDefined();
		expect(resolve(defs.get(DECK_TYPE), { ...cardShape("plain"), type: DECK_TYPE })).toBe(false);
	});

	it("per-card-type resizable overrides the plugin-wide default", () => {
		const defs = registeredDefs({
			// value cards fixed, playing cards resizable — plugin default false.
			cardTypes: [makeCardType("value", false), makeCardType("playing", true)],
			resizable: false,
		});
		expect(resolve(defs.get(CARD_TYPE), cardShape("value"))).toBe(false);
		expect(resolve(defs.get(CARD_TYPE), cardShape("playing"))).toBe(true);
	});

	it("per-card-type resizable:false works even when plugin default is true", () => {
		const defs = registeredDefs({
			cardTypes: [makeCardType("value", false), makeCardType("playing")],
		});
		expect(resolve(defs.get(CARD_TYPE), cardShape("value"))).toBe(false);
		expect(resolve(defs.get(CARD_TYPE), cardShape("playing"))).toBe(true);
	});
});
