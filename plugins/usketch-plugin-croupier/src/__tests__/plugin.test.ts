import { createValuesCardConfig } from "@edv4h/croupier-plugin-values-card";
import {
	createActionRegistry,
	createCommandRegistry,
	createServiceRegistry,
	createShapeRegistry,
	createToolRegistry,
} from "@edv4h/usketch-core";
import type { PluginContext } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { croupierService } from "../croupier-service.js";
import { CROUPIER_TABLE_TOOL_ID, createCroupierPlugin } from "../plugin.js";
import { getTable, joinTable, listSeats, startGame } from "../table-ops.js";
import { CROUPIER_SEAT_TYPE, CROUPIER_TABLE_TYPE, defineCroupierGame } from "../types.js";

const valuesCard = defineCroupierGame({
	id: "values-card",
	label: "Values Card",
	createConfig: () => createValuesCardConfig(),
});

function harness(opts: { userId: string; online?: Set<string> }) {
	const store = createBoardStore();
	const ctx = {
		store,
		shapes: createShapeRegistry(),
		tools: createToolRegistry(),
		actions: createActionRegistry(),
		commands: createCommandRegistry(),
		services: createServiceRegistry(),
	} as unknown as PluginContext;
	const listeners = new Set<() => void>();
	const online = opts.online;
	const dispose = createCroupierPlugin({
		player: { userId: opts.userId, name: opts.userId },
		games: [valuesCard],
		presence: online
			? {
					isOnline: (id) => online.has(id),
					subscribe: (l) => {
						listeners.add(l);
						return () => listeners.delete(l);
					},
				}
			: undefined,
	}).setup(ctx);
	const api = croupierService.get(ctx.services);
	if (!api) throw new Error("service not provided");
	const presenceChanged = () => {
		for (const l of listeners) l();
	};
	return { store, ctx, api, dispose: dispose as () => void, presenceChanged };
}

const registry = new Map([[valuesCard.id, valuesCard]]);

function must<T>(value: T | undefined): T {
	if (value === undefined) throw new Error("missing");
	return value;
}

describe("createCroupierPlugin", () => {
	it("registers both shapes, the placement tool, the service and HUD actions", () => {
		const { ctx } = harness({ userId: "alice" });
		expect(ctx.shapes.get(CROUPIER_TABLE_TYPE)).toBeDefined();
		expect(ctx.shapes.get(CROUPIER_SEAT_TYPE)).toBeDefined();
		expect(ctx.tools.get(CROUPIER_TABLE_TOOL_ID)).toBeDefined();
		const ids = ctx.actions.getOrdered().map((a) => a.id);
		expect(ids).toContain("croupier:new-table:values-card");
		expect(ids).toContain("croupier:join");
		expect(ids).toContain("croupier:start");
	});

	it("creates a table centered on a point, hosted by the local player", () => {
		const { api, store } = harness({ userId: "alice" });
		const id = api.createTable("values-card", { x: 1000, y: 1000 });
		expect(id).not.toBeNull();
		const table = must(getTable(store, id as string));
		expect(table.x).toBe(1000 - table.width / 2);
		expect(table.meta).toMatchObject({ hostUserId: "alice", phase: "lobby", game: "values-card" });
		expect(api.createTable("unknown", { x: 0, y: 0 })).toBeNull();
	});

	it("returns a stable view until the table or a seat changes", () => {
		const { api } = harness({ userId: "alice" });
		const id = api.createTable("values-card", { x: 0, y: 0 }) as string;
		const v1 = api.getView(id);
		expect(api.getView(id)).toBe(v1);
		api.join(id);
		const v2 = api.getView(id);
		expect(v2).not.toBe(v1);
		expect(v2?.mySeat?.meta.userId).toBe("alice");
		expect(api.getView(id)).toBe(v2);
	});

	it("notifies subscribers on shape changes only", () => {
		const { api, store } = harness({ userId: "alice" });
		const listener = vi.fn();
		api.subscribe(listener);
		api.createTable("values-card", { x: 0, y: 0 });
		expect(listener).toHaveBeenCalled();
		listener.mockClear();
		store.setSelection([]);
		expect(listener).not.toHaveBeenCalled();
	});

	it("resets a pasted copy of a table", () => {
		const { api, store } = harness({ userId: "alice" });
		const id = api.createTable("values-card", { x: 0, y: 0 }) as string;
		const table = must(getTable(store, id));
		store.addShape({ ...table, id: "copy" });
		expect(getTable(store, "copy")?.meta.tableId).toBe("copy");
	});

	it("lays out only seat children of a table", () => {
		const { api, store, ctx } = harness({ userId: "alice" });
		const id = api.createTable("values-card", { x: 0, y: 0 }) as string;
		api.join(id);
		const table = must(getTable(store, id));
		const seat = { ...listSeats(store, id)[0], x: 9999 };
		const note = { ...seat, id: "note", type: "sticky-note", meta: {} };
		const layout = ctx.shapes.get(CROUPIER_TABLE_TYPE)?.container?.layout;
		const patches = layout?.({ container: table, children: [note, seat] } as never) ?? [];
		expect(patches.map((p: { id: string }) => p.id)).toEqual([seat.id]);
	});

	it("acts as the player the getter returns now (e.g. after sign-in)", () => {
		const store = createBoardStore();
		const ctx = {
			store,
			shapes: createShapeRegistry(),
			tools: createToolRegistry(),
			actions: createActionRegistry(),
			commands: createCommandRegistry(),
			services: createServiceRegistry(),
		} as unknown as PluginContext;
		let player = { userId: "local", name: "Guest" };
		createCroupierPlugin({ player: () => player, games: [valuesCard] }).setup(ctx);
		const api = must(croupierService.get(ctx.services));
		const id = api.createTable("values-card", { x: 0, y: 0 }) as string;
		expect(getTable(store, id)?.meta.hostUserId).toBe("local");
		player = { userId: "alice", name: "Alice" };
		api.join(id);
		expect(listSeats(store, id).map((s) => s.meta.userId)).toEqual(["alice"]);
		expect(api.getView(id)?.mySeat?.meta.name).toBe("Alice");
	});

	it("disposes its service", () => {
		const { ctx, dispose } = harness({ userId: "alice" });
		dispose();
		expect(croupierService.get(ctx.services)).toBeUndefined();
	});
});

describe("absent players", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("the host's client plays the turn of a player who went offline", async () => {
		const online = new Set(["alice", "bob"]);
		const { api, store, presenceChanged } = harness({ userId: "alice", online });
		const id = api.createTable("values-card", { x: 0, y: 0 }) as string;
		joinTable(store, registry, id, { userId: "bob", name: "bob" }, Date.now() - 1);
		api.join(id);
		// Make bob first in turn order: he joined before alice.
		expect(listSeats(store, id).map((s) => s.meta.userId)).toEqual(["bob", "alice"]);
		expect(startGame(store, registry, id, "alice", Date.now(), 1)).toEqual({ ok: true });
		expect(api.getView(id)?.currentPlayers).toEqual(["bob"]);

		online.delete("bob");
		presenceChanged();
		await vi.advanceTimersByTimeAsync(10_000);
		expect(api.getView(id)?.currentPlayers).toEqual(["bob"]); // still in the grace period
		await vi.advanceTimersByTimeAsync(15_000);
		expect(api.getView(id)?.currentPlayers).toEqual(["alice"]);
	});

	it("the first connected player takes over from an offline host", async () => {
		const online = new Set(["alice", "bob"]);
		const { api, store } = harness({ userId: "bob", online });
		const tableId = api.createTable("values-card", { x: 0, y: 0 }) as string;
		// Make alice the host.
		const table = must(getTable(store, tableId));
		store.updateShape(tableId, { meta: { ...table.meta, hostUserId: "alice" } });
		joinTable(store, registry, tableId, { userId: "alice", name: "alice" }, 1);
		api.join(tableId);

		online.delete("alice");
		await vi.advanceTimersByTimeAsync(25_000);
		expect(getTable(store, tableId)?.meta.hostUserId).toBe("bob");
	});
});
