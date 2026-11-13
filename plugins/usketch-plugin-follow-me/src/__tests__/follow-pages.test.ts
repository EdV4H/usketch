import type { PluginAction, PluginContext } from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import { createFollowMePlugin } from "../plugin.js";

type State = Record<string, unknown>;

/** ボード全員の awareness（1 = 自分、2 = Alice）と、ページを持った follow-me。 */
function setup(currentPageId: string, states: Map<number, State>, switchPage = vi.fn()) {
	const listeners = new Set<() => void>();
	const awareness = {
		doc: { clientID: 1 },
		getStates: () => states,
		on: (_: string, fn: () => void) => listeners.add(fn),
		off: (_: string, fn: () => void) => listeners.delete(fn),
	};
	const actions = new Map<string, PluginAction>();
	const handlers = new Map<string, (data: unknown) => void>();
	const ctx = {
		store: {
			getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
			setViewport: () => {},
			animateViewportTo: () => {},
		},
		actions: {
			register(action: PluginAction) {
				actions.set(action.id, action);
				return () => actions.delete(action.id);
			},
		},
		layers: { register: () => {}, unregister: () => {} },
		events: {
			on: (name: string, fn: (data: unknown) => void) => {
				handlers.set(name, fn);
				return () => handlers.delete(name);
			},
		},
		shortcuts: { register: () => () => {} },
	} as unknown as PluginContext;
	const plugin = createFollowMePlugin({
		// 今のページに絞った awareness（ここでは使われない）
		wsProvider: { awareness: { ...awareness, getStates: () => new Map() } } as never,
		pages: { awareness: awareness as never, currentPageId, switchPage },
	});
	const cleanup = plugin.setup(ctx) as () => void;
	const emit = () => {
		for (const fn of listeners) fn();
	};
	return { actions, handlers, emit, cleanup, switchPage };
}

describe("follow-me（マルチページ）", () => {
	it("別のページの人も一覧に出し、追うとそのページへ移って、次の App で追い続ける", () => {
		const states = new Map<number, State>([
			[1, { user: { name: "Me" }, page: "p1" }],
			[2, { user: { name: "Alice" }, page: "p2", viewportCenter: { x: 0, y: 0 } }],
		]);
		const first = setup("p1", states);
		expect(first.actions.get("follow:member:2")?.label).toBe("👤 Alice（別のページ）");

		first.handlers.get("follow:start")?.({ clientId: 2, name: "Alice" });
		first.emit();
		expect(first.switchPage).toHaveBeenCalledWith("p2");
		first.cleanup();

		// ホストが p2 で App を作り直す
		states.set(1, { user: { name: "Me" }, page: "p2" });
		const second = setup("p2", states);
		expect(second.actions.get("follow:member:2")?.label).toBe("👤 Alice");
		expect(second.actions.get("follow:unfollow")?.isEnabled?.()).toBe(true);
		expect(second.switchPage).not.toHaveBeenCalled();
		second.cleanup();
	});

	it("同じページの人を追っても、ページは切り替えない", () => {
		const states = new Map<number, State>([
			[1, { user: { name: "Me" }, page: "p1" }],
			[2, { user: { name: "Alice" }, page: "p1", viewportCenter: { x: 0, y: 0 } }],
		]);
		const h = setup("p1", states);
		h.handlers.get("follow:start")?.({ clientId: 2, name: "Alice" });
		h.emit();
		expect(h.switchPage).not.toHaveBeenCalled();
		h.cleanup();
	});
});
