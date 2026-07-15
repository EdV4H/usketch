import type { PluginContext, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import { CARD_TYPE } from "../factory.js";
import { createCardPlugin } from "../plugin.js";
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

/** Mock ctx: real in-memory store + event bus + command runner + count-awareness spy. */
function harness() {
	const shapes = new Map<string, ShapeData>();
	const selection = new Set<string>();
	const handlers = new Map<string, (p: unknown) => void>();
	const setLocalStateField = vi.fn();
	const noop = () => {};

	const ctx = {
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
		shortcuts: { register: () => noop },
		store: {
			getShape: (id: string) => shapes.get(id),
			getShapes: () => shapes,
			getShapesSorted: () => [...shapes.values()],
			getSelection: () => selection,
			getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
			addShape: (s: ShapeData) => shapes.set(s.id, s),
			deleteShape: (id: string) => shapes.delete(id),
			updateShape: (id: string, patch: Partial<ShapeData>) => {
				const s = shapes.get(id);
				if (s) shapes.set(id, { ...s, ...patch });
			},
			setSelection: (ids: string[]) => {
				selection.clear();
				for (const i of ids) selection.add(i);
			},
			resetToDefaultTool: noop,
		},
		commands: { execute: (cmd: { execute(): void }) => cmd.execute() },
	} as unknown as PluginContext;

	createCardPlugin({
		cardTypes: [makeCardType()],
		userId: "u1",
		wsProvider: { awareness: { setLocalStateField } as never },
	}).setup(ctx);

	const emit = (type: string, id: string) => ctx.events.emit(type, { id });
	const lastCount = () => {
		const calls = setLocalStateField.mock.calls;
		const last = calls[calls.length - 1];
		return (last?.[1] as { count?: number } | null)?.count;
	};
	return { shapes, emit, lastCount };
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

describe("card hand flow (events)", () => {
	it("card:to-hand removes the shape from the board and bumps the shared count", () => {
		const { shapes, emit, lastCount } = harness();
		shapes.set("c1", cardShape("c1"));

		emit("card:to-hand", "c1");

		expect(shapes.has("c1")).toBe(false); // 盤面から消える（内容は共有されない）
		expect(lastCount()).toBe(1); // 枚数だけ共有
	});

	it("card:play-from-hand puts the card back on the board and decrements the count", () => {
		const { shapes, emit, lastCount } = harness();
		shapes.set("c1", cardShape("c1"));

		emit("card:to-hand", "c1");
		expect(shapes.has("c1")).toBe(false);

		emit("card:play-from-hand", "c1");
		const back = shapes.get("c1");
		expect(back?.type).toBe(CARD_TYPE);
		expect((back?.meta as { fields?: { rank?: string } })?.fields?.rank).toBe("A");
		expect(lastCount()).toBe(0);
	});

	it("card:flip toggles isFlipped without leaving the board", () => {
		const { shapes, emit } = harness();
		shapes.set("c1", cardShape("c1"));
		emit("card:flip", "c1");
		expect((shapes.get("c1")?.meta as { isFlipped?: boolean })?.isFlipped).toBe(true);
	});
});
