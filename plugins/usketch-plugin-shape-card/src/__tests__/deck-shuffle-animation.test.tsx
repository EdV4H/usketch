import type { Command, PluginContext, ShapeData } from "@edv4h/usketch-shared";
import { isValidElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { DECK_TYPE } from "../factory.js";
import { createCardPlugin } from "../plugin.js";
import { createDeckRenderer, resolveShuffleEnd } from "../render-deck.js";
import type { CardTypeDefinition, DeckShuffleAnimation, DeckShuffleRenderProps } from "../types.js";

function makeCardType(id: string, shuffleAnimation?: DeckShuffleAnimation): CardTypeDefinition {
	return {
		id,
		label: id,
		aspectRatio: 2 / 3,
		defaultSize: { width: 100, height: 150 },
		...(shuffleAnimation ? { shuffleAnimation } : {}),
		icon: () => null as never,
		createDefaultFields: () => ({}),
		renderFront: () => null as never,
		renderBack: () => (<span data-kind="back" />) as ReactElement,
	};
}

function deckShape(meta: Record<string, unknown>): ShapeData {
	return {
		id: "d1",
		type: DECK_TYPE,
		x: 0,
		y: 0,
		width: 100,
		height: 150,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
		meta: { cardType: "t", cards: [{ n: 1 }, { n: 2 }, { n: 3 }], faceDown: true, ...meta },
	} as ShapeData;
}

const animation = (durationMs: DeckShuffleAnimation["durationMs"]): DeckShuffleAnimation => ({
	durationMs,
	render: () => (<div data-kind="shuffling" />) as ReactElement,
});

describe("resolveShuffleEnd", () => {
	it("returns null without an animation or a shuffle time", () => {
		const def = makeCardType("t");
		expect(resolveShuffleEnd(deckShape({ shuffledAt: 1000 }), def, undefined, 1000)).toBeNull();
		expect(resolveShuffleEnd(deckShape({}), def, animation(500), 1000)).toBeNull();
	});

	it("plays from shuffledAt for durationMs", () => {
		const def = makeCardType("t");
		const shape = deckShape({ shuffledAt: 1000 });
		expect(resolveShuffleEnd(shape, def, animation(500), 1200)).toMatchObject({
			startAt: 1000,
			durationMs: 500,
		});
		expect(resolveShuffleEnd(shape, def, animation(500), 1500)).toBeNull();
	});

	it("resolves a duration that depends on the count", () => {
		const def = makeCardType("t");
		const byCount = vi.fn((count: number) => count * 100);
		const shape = deckShape({ shuffledAt: 1000 });
		expect(resolveShuffleEnd(shape, def, animation(byCount), 1000)?.durationMs).toBe(300);
		expect(byCount).toHaveBeenCalledWith(3);
	});

	it("prefers the card-type animation over the plugin default", () => {
		const own = animation(800);
		const def = makeCardType("t", own);
		const r = resolveShuffleEnd(deckShape({ shuffledAt: 0 }), def, animation(100), 500);
		expect(r?.animation).toBe(own);
	});

	it("does not play for a deck that cannot be shuffled", () => {
		const def = makeCardType("t");
		const shape = deckShape({ shuffledAt: 1000, cards: [{ n: 1 }] });
		expect(resolveShuffleEnd(shape, def, animation(500), 1000)).toBeNull();
	});
});

describe("createDeckRenderer with shuffleAnimation", () => {
	it("hands the host the shuffle details while it plays", () => {
		const render = vi.fn<(p: DeckShuffleRenderProps) => ReactElement>(
			() => (<div data-kind="shuffling" />) as ReactElement,
		);
		const def = makeCardType("t");
		const renderDeck = createDeckRenderer(new Map([["t", def]]), { durationMs: 1000, render });
		const now = Date.now();
		const out = renderDeck(deckShape({ shuffledAt: now }));
		expect(isValidElement(out)).toBe(true);
		expect(render).toHaveBeenCalledTimes(1);
		const props = render.mock.calls[0]?.[0] as DeckShuffleRenderProps;
		expect(props).toMatchObject({ count: 3, startAt: now, durationMs: 1000, faceDown: true });
		expect(isValidElement(props.renderBack())).toBe(true);
	});

	it("draws the resting deck once the shuffle is over", () => {
		const render = vi.fn(() => (<div />) as ReactElement);
		const def = makeCardType("t");
		const renderDeck = createDeckRenderer(new Map([["t", def]]), { durationMs: 1000, render });
		renderDeck(deckShape({ shuffledAt: Date.now() - 5000 }));
		expect(render).not.toHaveBeenCalled();
	});
});

describe("card-deck:shuffle", () => {
	it("records when the deck was shuffled, and undo restores the previous time", () => {
		const handlers = new Map<string, (data: unknown) => void>();
		const executed: Command[] = [];
		let deck = deckShape({ shuffledAt: 10 });
		const noop = () => {};
		const off = () => () => {};
		const ctx = {
			events: {
				on: (name: string, fn: (data: unknown) => void) => {
					handlers.set(name, fn);
					return noop;
				},
				emit: noop,
				off: noop,
			},
			transient: { registerType: noop, emit: noop },
			shapes: { register: noop, get: () => undefined },
			tools: { register: noop },
			layers: { register: noop, unregister: noop },
			hud: { registerPanel: () => noop, registerSettings: () => noop },
			actions: { register: () => noop, unregister: noop, get: () => undefined },
			shortcuts: { register: off },
			store: {
				getShape: (id: string) => (id === deck.id ? deck : undefined),
				getShapesSorted: () => [deck],
				getSelection: () => new Set<string>(),
				updateShape: (_id: string, patch: Partial<ShapeData>) => {
					deck = { ...deck, ...patch };
				},
				addShape: noop,
				deleteShape: noop,
				setSelection: noop,
				resetToDefaultTool: noop,
			},
			commands: {
				execute: (command: Command) => {
					executed.push(command);
					command.execute();
				},
			},
		} as unknown as PluginContext;

		createCardPlugin({ cardTypes: [makeCardType("t")] }).setup(ctx);
		vi.spyOn(Date, "now").mockReturnValue(12345);
		handlers.get("card-deck:shuffle")?.({ id: "d1" });
		vi.restoreAllMocks();

		expect((deck.meta as { shuffledAt?: number }).shuffledAt).toBe(12345);
		expect((deck.meta as { cards: unknown[] }).cards).toHaveLength(3);
		executed[0]?.undo();
		expect((deck.meta as { shuffledAt?: number }).shuffledAt).toBe(10);
	});
});
