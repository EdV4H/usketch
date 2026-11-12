import { describe, expect, it, vi } from "vitest";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import {
	createPageScopedAwareness,
	createPageScopedProvider,
	PAGE_BROADCAST_FIELD,
} from "../page-scope.js";
import type { WsProviderHandle } from "../ws-provider.js";

/** 他のクライアントの awareness 状態を手で入れる。 */
function setRemote(awareness: Awareness, clientId: number, state: Record<string, unknown> | null) {
	const prev = awareness.states.get(clientId);
	if (state === null) {
		awareness.states.delete(clientId);
		awareness.emit("change", [{ added: [], updated: [], removed: [clientId] }, "remote"]);
		return;
	}
	awareness.states.set(clientId, state);
	awareness.meta.set(clientId, { clock: 0, lastUpdated: Date.now() });
	const changes = prev
		? { added: [], updated: [clientId], removed: [] }
		: { added: [clientId], updated: [], removed: [] };
	awareness.emit("change", [changes, "remote"]);
}

function setup() {
	const awareness = new Awareness(new Y.Doc());
	awareness.setLocalState({ page: "a" });
	return awareness;
}

describe("createPageScopedAwareness", () => {
	it("getStates は自分と同じページの人だけ返す", () => {
		const awareness = setup();
		setRemote(awareness, 101, { page: "a" });
		setRemote(awareness, 102, { page: "b" });
		setRemote(awareness, 103, {});
		const scoped = createPageScopedAwareness(awareness, "a");
		expect([...scoped.getStates().keys()].sort()).toEqual([awareness.clientID, 101].sort());
		// 元の awareness の値はそのまま読める
		expect(scoped.clientID).toBe(awareness.clientID);
		expect(scoped.doc).toBe(awareness.doc);
	});

	it("change はページの出入りを added / removed に直して届ける", () => {
		const awareness = setup();
		const scoped = createPageScopedAwareness(awareness, "a");
		const handler = vi.fn();
		scoped.on("change", handler);

		setRemote(awareness, 101, { page: "b" });
		expect(handler).not.toHaveBeenCalled();

		setRemote(awareness, 101, { page: "a" });
		expect(handler).toHaveBeenLastCalledWith({ added: [101], updated: [], removed: [] }, "remote");

		setRemote(awareness, 101, { page: "a", cursor: 1 });
		expect(handler).toHaveBeenLastCalledWith({ added: [], updated: [101], removed: [] }, "remote");

		setRemote(awareness, 101, { page: "b" });
		expect(handler).toHaveBeenLastCalledWith({ added: [], updated: [], removed: [101] }, "remote");

		setRemote(awareness, 101, null);
		expect(handler).toHaveBeenCalledTimes(3);

		scoped.off("change", handler);
		setRemote(awareness, 102, { page: "a" });
		expect(handler).toHaveBeenCalledTimes(3);
	});

	it("setLocalState で丸ごと差し替えても page を残す", () => {
		const awareness = setup();
		const scoped = createPageScopedAwareness(awareness, "a");
		scoped.setLocalState({ cursor: { x: 1, y: 2 } });
		expect(awareness.getLocalState()).toEqual({ cursor: { x: 1, y: 2 }, page: "a" });
		scoped.setLocalStateField("name", "me");
		expect(awareness.getLocalState()).toEqual({ cursor: { x: 1, y: 2 }, page: "a", name: "me" });
		scoped.setLocalState(null);
		expect(awareness.getLocalState()).toBeNull();
	});

	it("dispose / destroy は元の awareness を壊さず listener だけ外す", () => {
		const awareness = setup();
		const scoped = createPageScopedAwareness(awareness, "a");
		const handler = vi.fn();
		scoped.on("change", handler);
		scoped.destroy();
		setRemote(awareness, 101, { page: "a" });
		expect(handler).not.toHaveBeenCalled();
		expect(awareness.getLocalState()).toEqual({ page: "a" });
	});
});

function fakeProvider(awareness: Awareness) {
	const listeners = new Set<(msg: Record<string, unknown>) => void>();
	const sent: Record<string, unknown>[] = [];
	const provider = {
		get connected() {
			return true;
		},
		awareness,
		broadcast: (msg: Record<string, unknown>) => sent.push(msg),
		onBroadcast: (handler: (msg: Record<string, unknown>) => void) => {
			listeners.add(handler);
			return () => listeners.delete(handler);
		},
		destroy: vi.fn(),
	} as unknown as WsProviderHandle;
	return {
		provider,
		sent,
		listeners,
		deliver: (msg: Record<string, unknown>) => {
			for (const l of listeners) l(msg);
		},
	};
}

describe("createPageScopedProvider", () => {
	it("自分の awareness に page を書き、同じページだけ見せる", () => {
		const awareness = new Awareness(new Y.Doc());
		const { provider } = fakeProvider(awareness);
		const scoped = createPageScopedProvider(provider, "a");
		expect(awareness.getLocalState()?.page).toBe("a");
		setRemote(awareness, 101, { page: "b" });
		expect(scoped.awareness.getStates().has(101)).toBe(false);
		expect(scoped.connected).toBe(true);
	});

	it("broadcast にページを付け、同じページ（とページ無し）だけを届ける", () => {
		const awareness = new Awareness(new Y.Doc());
		const { provider, sent, deliver, listeners } = fakeProvider(awareness);
		const scoped = createPageScopedProvider(provider, "a");
		scoped.broadcast({ type: "laser" });
		expect(sent).toEqual([{ type: "laser", [PAGE_BROADCAST_FIELD]: "a" }]);

		const handler = vi.fn();
		scoped.onBroadcast(handler);
		deliver({ type: "x", [PAGE_BROADCAST_FIELD]: "b" });
		deliver({ type: "y", [PAGE_BROADCAST_FIELD]: "a" });
		deliver({ type: "z" });
		expect(handler.mock.calls.map(([m]) => m.type)).toEqual(["y", "z"]);

		scoped.dispose();
		expect(listeners.size).toBe(0);
		expect(provider.destroy).not.toHaveBeenCalled();
	});
});
