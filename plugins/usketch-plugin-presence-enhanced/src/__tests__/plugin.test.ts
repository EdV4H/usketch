import type { PluginContext } from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPresenceEnhancedPlugin } from "../plugin.js";

type ChangeHandler = (
	change: { added: number[]; updated: number[]; removed: number[] },
	origin: unknown,
) => void;

/** y-protocols Awareness の "change" と同じ形でイベントを流せる最小のフェイク。 */
function createFakeAwareness() {
	const handlers = new Set<ChangeHandler>();
	const states = new Map<number, Record<string, unknown>>([[1, {}]]);
	return {
		getStates: () => states,
		on: (_: "change", h: ChangeHandler) => handlers.add(h),
		off: (_: "change", h: ChangeHandler) => handlers.delete(h),
		emit(change: { added?: number[]; updated?: number[]; removed?: number[] }) {
			for (const h of handlers) {
				h({ added: [], updated: [], removed: [], ...change }, "remote");
			}
		},
		listenerCount: () => handlers.size,
	};
}

function setupPlugin() {
	const awareness = createFakeAwareness();
	const ctx = {
		transient: { registerType: vi.fn(), emit: vi.fn(), dismiss: vi.fn() },
		layers: { unregister: vi.fn() },
	} as unknown as PluginContext;
	const plugin = createPresenceEnhancedPlugin({
		wsProvider: { awareness } as unknown as WsProviderHandle,
		boardId: "board-1",
		apiUrl: "https://api.example",
	});
	const cleanup = plugin.setup?.(ctx) as (() => void) | undefined;
	return { awareness, cleanup };
}

describe("createPresenceEnhancedPlugin", () => {
	const fetchMock = vi.fn(async () => new Response("[]", { status: 200 }));

	beforeEach(() => {
		vi.useFakeTimers();
		fetchMock.mockClear();
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("fetches the member list once on setup", () => {
		const { cleanup } = setupPlugin();
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.example/api/boards/board-1/members",
			expect.objectContaining({ credentials: "include" }),
		);
		cleanup?.();
	});

	it("does not refetch when existing participants only update their state (cursor moves)", () => {
		const { awareness, cleanup } = setupPlugin();
		for (let i = 0; i < 100; i++) awareness.emit({ updated: [1] });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		cleanup?.();
	});

	it("refetches when a participant joins or leaves", () => {
		const { awareness, cleanup } = setupPlugin();
		awareness.emit({ added: [2] });
		expect(fetchMock).toHaveBeenCalledTimes(2);
		awareness.emit({ removed: [2] });
		expect(fetchMock).toHaveBeenCalledTimes(3);
		cleanup?.();
	});

	it("keeps polling every 30 seconds and detaches the listener on cleanup", () => {
		const { awareness, cleanup } = setupPlugin();
		vi.advanceTimersByTime(30_000);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		cleanup?.();
		expect(awareness.listenerCount()).toBe(0);
		vi.advanceTimersByTime(30_000);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
