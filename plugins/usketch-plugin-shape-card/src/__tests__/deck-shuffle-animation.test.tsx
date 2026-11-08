import type { Command, PluginContext, ShapeData } from "@edv4h/usketch-shared";
import { isValidElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { DECK_TYPE } from "../factory.js";
import { createCardPlugin } from "../plugin.js";
import { createDeckRenderer, resolveShuffleEnd } from "../render-deck.js";
import type { CardTypeDefinition, DeckShuffleAnimation, DeckShuffleRenderProps } from "../types.js";
import { readDeckMeta } from "../types.js";

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
		expect(
			resolveShuffleEnd(readDeckMeta(deckShape({ shuffledAt: 1000 })), def, undefined, 1000),
		).toBeNull();
		expect(resolveShuffleEnd(readDeckMeta(deckShape({})), def, animation(500), 1000)).toBeNull();
	});

	it("plays from shuffledAt for durationMs", () => {
		const def = makeCardType("t");
		const shape = deckShape({ shuffledAt: 1000 });
		expect(resolveShuffleEnd(readDeckMeta(shape), def, animation(500), 1200)).toMatchObject({
			startAt: 1000,
			durationMs: 500,
		});
		expect(resolveShuffleEnd(readDeckMeta(shape), def, animation(500), 1500)).toBeNull();
	});

	it("resolves a duration that depends on the deck", () => {
		const def = makeCardType("t");
		const byCount = vi.fn(({ count }: { count: number; startAt: number }) => count * 100);
		const shape = deckShape({ shuffledAt: 1000 });
		expect(resolveShuffleEnd(readDeckMeta(shape), def, animation(byCount), 1000)?.durationMs).toBe(
			300,
		);
		expect(byCount).toHaveBeenCalledWith({ count: 3, startAt: 1000 });
	});

	it("prefers the card-type animation over the plugin default", () => {
		const own = animation(800);
		const def = makeCardType("t", own);
		const r = resolveShuffleEnd(
			readDeckMeta(deckShape({ shuffledAt: 0 })),
			def,
			animation(100),
			500,
		);
		expect(r?.animation).toBe(own);
	});

	it("does not play for a deck that cannot be shuffled", () => {
		const def = makeCardType("t");
		const shape = deckShape({ shuffledAt: 1000, cards: [{ n: 1 }] });
		expect(resolveShuffleEnd(readDeckMeta(shape), def, animation(500), 1000)).toBeNull();
	});
});

type GateProps = { until: number; playing: ReactElement; idle: ReactElement };

/** 要素ツリーから `type` の要素を探す（描画せずに中身を確かめる）。 */
function findElement(node: unknown, type: unknown): ReactElement<DeckShuffleRenderProps> | null {
	if (!isValidElement(node)) {
		if (Array.isArray(node)) {
			for (const child of node) {
				const hit = findElement(child, type);
				if (hit) return hit;
			}
		}
		return null;
	}
	if (node.type === type) return node as ReactElement<DeckShuffleRenderProps>;
	return findElement((node.props as { children?: unknown }).children, type);
}

describe("createDeckRenderer with shuffleAnimation", () => {
	it("hands the host the shuffle details while it plays", () => {
		const render = vi.fn<(p: DeckShuffleRenderProps) => ReactElement>(
			() => (<div data-kind="shuffling" />) as ReactElement,
		);
		const def = makeCardType("t");
		const renderDeck = createDeckRenderer(new Map([["t", def]]), { durationMs: 1000, render });
		const now = Date.now();
		const out = renderDeck(deckShape({ shuffledAt: now })) as ReactElement<GateProps>;
		expect(out.props.until).toBe(now + 1000);
		// host の render は要素として描く (hooks を使えるように、その場では呼ばない)。
		expect(render).not.toHaveBeenCalled();
		const host = findElement(out.props.playing, render);
		expect(host?.props).toMatchObject({
			count: 3,
			startAt: now,
			durationMs: 1000,
			faceDown: true,
		});
		expect(isValidElement(host?.props.renderBack())).toBe(true);
		expect(isValidElement(host?.props.renderTop())).toBe(true);
		// 外枠と残枚数バッジはプラグインが描いたまま。
		expect(JSON.stringify(out.props.playing.props)).toContain('"children":3');
		expect(findElement(out.props.idle, render)).toBeNull();
	});

	it("draws the resting deck once the shuffle is over", () => {
		const render = vi.fn(() => (<div />) as ReactElement);
		const def = makeCardType("t");
		const renderDeck = createDeckRenderer(new Map([["t", def]]), { durationMs: 1000, render });
		const out = renderDeck(deckShape({ shuffledAt: Date.now() - 5000 }));
		expect(findElement(out, render)).toBeNull();
		expect((out as ReactElement<Partial<GateProps>>).props.until).toBeUndefined();
	});
});

describe("clock skew", () => {
	it("ignores a shuffle time further ahead than the animation lasts", () => {
		const def = makeCardType("t");
		const shape = deckShape({ shuffledAt: 10_000 });
		expect(resolveShuffleEnd(readDeckMeta(shape), def, animation(500), 9_600)).not.toBeNull();
		expect(resolveShuffleEnd(readDeckMeta(shape), def, animation(500), 9_000)).toBeNull();
	});
});

describe("card-deck:shuffle", () => {
	it("records when the deck was shuffled, and undo drops it so nothing replays", () => {
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
		expect((deck.meta as { shuffledAt?: number }).shuffledAt).toBeUndefined();
		expect((deck.meta as { cardType: string }).cardType).toBe("t");
	});

	it("does not touch a deck with fewer than two cards", () => {
		const handlers = new Map<string, (data: unknown) => void>();
		const execute = vi.fn();
		const deck = deckShape({ cards: [{ n: 1 }] });
		const noop = () => {};
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
			shortcuts: { register: () => noop },
			store: {
				getShape: () => deck,
				getShapesSorted: () => [deck],
				getSelection: () => new Set<string>(),
			},
			commands: { execute },
		} as unknown as PluginContext;
		createCardPlugin({ cardTypes: [makeCardType("t")] }).setup(ctx);
		handlers.get("card-deck:shuffle")?.({ id: "d1" });
		expect(execute).not.toHaveBeenCalled();
	});
});
