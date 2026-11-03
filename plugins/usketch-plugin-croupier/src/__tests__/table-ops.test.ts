import { createValuesCardConfig } from "@edv4h/croupier-plugin-values-card";
import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import { bindGameState, createMapGameState, type GameStateMap } from "../game-state.js";
import {
	claimHost,
	dispatchAction,
	endGame,
	type GameRegistry,
	getTable,
	getTableView,
	isSeat,
	isTable,
	joinTable,
	kickFromTable,
	leaveTable,
	listSeats,
	makeTableShape,
	repairTables,
	resetTable,
	seatIdFor,
	setSeatNote,
	startGame,
	takeOverTurn,
} from "../table-ops.js";
import { defineCroupierGame } from "../types.js";

const valuesCard = defineCroupierGame({
	id: "values-card",
	label: "Values Card",
	createConfig: (options) => createValuesCardConfig({ theme: String(options.theme ?? "") }),
	defaultOptions: { theme: "大事にしたいこと" },
	maxPlayers: 3,
});
const registry: GameRegistry = new Map([[valuesCard.id, valuesCard]]);

const alice = { userId: "alice", name: "Alice" };
const bob = { userId: "bob", name: "Bob" };
const carol = { userId: "carol", name: "Carol" };

function setup(): { store: BoardStore; tableId: string } {
	const store = createBoardStore();
	const table = makeTableShape(registry, {
		id: "t1",
		game: "values-card",
		x: 0,
		y: 0,
		host: alice,
	});
	store.addShape(table);
	return { store, tableId: table.id };
}

function seatAll(store: BoardStore, tableId: string, players = [alice, bob]) {
	players.forEach((p, i) => {
		expect(joinTable(store, registry, tableId, p, 100 + i)).toEqual({ ok: true });
	});
}

type VcView = {
	deckCount: number;
	discardPool: { card: { id: string } }[];
	players: Record<string, { hand?: { id: string }[]; handCount?: number }>;
};

const viewOf = (store: BoardStore, tableId: string, viewer: string) =>
	getTableView(store, registry, tableId, viewer);

function gameViewOf(store: BoardStore, tableId: string, viewer: string): VcView {
	const view = viewOf(store, tableId, viewer)?.gameView;
	if (!view) throw new Error("no game view");
	return view as VcView;
}

describe("lobby", () => {
	it("joining adds one seat shape per player, in join order", () => {
		const { store, tableId } = setup();
		seatAll(store, tableId, [alice, bob]);
		// Joining twice is a no-op.
		expect(joinTable(store, registry, tableId, bob, 500)).toEqual({ ok: true });
		const seats = listSeats(store, tableId);
		expect(seats.map((s) => s.meta.userId)).toEqual(["alice", "bob"]);
		expect(seats.map((s) => s.id)).toEqual([seatIdFor("t1", "alice"), seatIdFor("t1", "bob")]);
		expect(seats.every((s) => s.parentId === tableId)).toBe(true);
	});

	it("refuses players beyond maxPlayers", () => {
		const { store, tableId } = setup();
		seatAll(store, tableId, [alice, bob, carol]);
		const dave = { userId: "dave", name: "Dave" };
		expect(joinTable(store, registry, tableId, dave, 999).ok).toBe(false);
		expect(viewOf(store, tableId, "dave")?.canJoin).toBe(false);
	});

	it("only the host can start, and only with enough players", () => {
		const { store, tableId } = setup();
		joinTable(store, registry, tableId, alice, 1);
		expect(startGame(store, registry, tableId, "alice", 2).ok).toBe(false); // 1 player
		joinTable(store, registry, tableId, bob, 3);
		expect(startGame(store, registry, tableId, "bob", 4).ok).toBe(false); // not host
		expect(viewOf(store, tableId, "alice")?.canStart).toBe(true);
		expect(startGame(store, registry, tableId, "alice", 5, 42)).toEqual({ ok: true });
		expect(getTable(store, tableId)?.meta.phase).toBe("playing");
		// No joining once started.
		expect(joinTable(store, registry, tableId, carol, 6).ok).toBe(false);
	});

	it("hands the host role to the next seat when the host leaves the lobby", () => {
		const { store, tableId } = setup();
		seatAll(store, tableId);
		expect(leaveTable(store, tableId, "alice")).toEqual({ ok: true });
		expect(getTable(store, tableId)?.meta.hostUserId).toBe("bob");
		expect(listSeats(store, tableId).map((s) => s.meta.userId)).toEqual(["bob"]);
	});

	it("lets the host remove a player, but not others", () => {
		const { store, tableId } = setup();
		seatAll(store, tableId);
		expect(kickFromTable(store, tableId, "bob", "alice").ok).toBe(false);
		expect(kickFromTable(store, tableId, "alice", "bob")).toEqual({ ok: true });
		expect(listSeats(store, tableId).map((s) => s.meta.userId)).toEqual(["alice"]);
	});

	it("claimHost needs the host to be gone (no seat) or reported away", () => {
		const { store, tableId } = setup();
		seatAll(store, tableId);
		expect(claimHost(store, tableId, "bob").ok).toBe(false);
		expect(claimHost(store, tableId, "bob", true)).toEqual({ ok: true });
		expect(getTable(store, tableId)?.meta.hostUserId).toBe("bob");
	});
});

describe("playing through the engine snapshot", () => {
	it("masks other players' hands and only lets the current player act", () => {
		const { store, tableId } = setup();
		seatAll(store, tableId);
		startGame(store, registry, tableId, "alice", 10, 7);

		const a = viewOf(store, tableId, "alice");
		const b = viewOf(store, tableId, "bob");
		const aView = a?.gameView as VcView;
		expect(aView.players.alice.hand).toHaveLength(5);
		expect(aView.players.bob.hand).toBeUndefined();
		expect(aView.players.bob.handCount).toBe(5);
		expect(a?.isMyTurn).toBe(true);
		expect(a?.allowedActions).toEqual(["drawFromDeck", "drawFromDiscard"]);
		expect(b?.isMyTurn).toBe(false);
		expect(b?.allowedActions).toEqual([]);
		// The final result is never exposed before the end (it would show every hand).
		expect(a?.result).toBeNull();

		expect(dispatchAction(store, registry, tableId, "bob", "drawFromDeck", undefined, 11).ok).toBe(
			false,
		);
	});

	it("plays a whole game, restoring the engine from the table on every action", () => {
		const { store, tableId } = setup();
		seatAll(store, tableId);
		startGame(store, registry, tableId, "alice", 10, 1);

		let guard = 0;
		while (getTable(store, tableId)?.meta.phase === "playing" && guard++ < 200) {
			const turnPlayer = viewOf(store, tableId, "alice")?.currentPlayers[0] as string;
			const before = getTable(store, tableId)?.meta.snapshot?.revision ?? 0;
			expect(
				dispatchAction(store, registry, tableId, turnPlayer, "drawFromDeck", undefined, 20),
			).toEqual({ ok: true });
			const mine = gameViewOf(store, tableId, turnPlayer).players[turnPlayer];
			expect(mine.hand).toHaveLength(6);
			const discard = mine.hand?.[0]?.id;
			expect(
				dispatchAction(
					store,
					registry,
					tableId,
					turnPlayer,
					"discardCard",
					{ cardId: discard },
					21,
				),
			).toEqual({ ok: true });
			expect(getTable(store, tableId)?.meta.snapshot?.revision).toBe(before + 2);
		}

		const table = getTable(store, tableId);
		expect(table?.meta.phase).toBe("finished");
		// 70 cards, 10 dealt: the deck runs out after 60 turns.
		expect(guard).toBe(60);
		// The snapshot log stays bounded.
		expect(table?.meta.snapshot?.log.length).toBeLessThanOrEqual(30);
		const end = viewOf(store, tableId, "bob");
		expect(end?.currentPlayers).toEqual([]);
		const result = end?.result as { finalHands: Record<string, unknown[]> } | null;
		expect(result?.finalHands.alice).toHaveLength(5);
		expect(result?.finalHands.bob).toHaveLength(5);
	});

	it("takes a card someone else discarded", () => {
		const { store, tableId } = setup();
		seatAll(store, tableId);
		startGame(store, registry, tableId, "alice", 10, 3);
		dispatchAction(store, registry, tableId, "alice", "drawFromDeck", undefined, 11);
		const aliceHand = gameViewOf(store, tableId, "alice").players.alice.hand ?? [];
		const thrown = aliceHand[2].id;
		dispatchAction(store, registry, tableId, "alice", "discardCard", { cardId: thrown }, 12);

		expect(
			dispatchAction(store, registry, tableId, "bob", "drawFromDiscard", { cardId: thrown }, 13),
		).toEqual({ ok: true });
		const bobView = viewOf(store, tableId, "bob")?.gameView as VcView;
		expect(bobView.players.bob.hand?.some((c) => c.id === thrown)).toBe(true);
		expect(bobView.discardPool).toHaveLength(0);
	});

	it("lets the host play an absent player's turn with the game's bot", async () => {
		const { store, tableId } = setup();
		seatAll(store, tableId);
		startGame(store, registry, tableId, "alice", 10, 5);
		dispatchAction(store, registry, tableId, "alice", "drawFromDeck", undefined, 11);
		const hand = gameViewOf(store, tableId, "alice").players.alice.hand ?? [];
		dispatchAction(store, registry, tableId, "alice", "discardCard", { cardId: hand[0].id }, 12);
		expect(viewOf(store, tableId, "alice")?.currentPlayers).toEqual(["bob"]);

		expect((await takeOverTurn(store, registry, tableId, "bob", () => 13)).ok).toBe(false);
		expect(await takeOverTurn(store, registry, tableId, "alice", () => 13)).toEqual({ ok: true });
		// The bot draws and discards, which ends bob's turn.
		expect(viewOf(store, tableId, "alice")?.currentPlayers).toEqual(["alice"]);
		expect(getTable(store, tableId)?.meta.turnStartedAt).toBe(13);
	});

	it("plays only the listed players' turns when told who is absent", async () => {
		const { store, tableId } = setup();
		seatAll(store, tableId);
		startGame(store, registry, tableId, "alice", 10, 5);
		expect(viewOf(store, tableId, "alice")?.currentPlayers).toEqual(["alice"]);
		// Bob is absent, but it is alice's (online) turn: the bot must not move for her.
		expect((await takeOverTurn(store, registry, tableId, "alice", () => 11, ["bob"])).ok).toBe(
			false,
		);
		expect(viewOf(store, tableId, "alice")?.stage).toBe("waitingForDraw");
		expect(viewOf(store, tableId, "alice")?.currentPlayers).toEqual(["alice"]);
	});

	it("ends early on the host's request and resets to the lobby", () => {
		const { store, tableId } = setup();
		seatAll(store, tableId);
		startGame(store, registry, tableId, "alice", 10, 5);
		expect(endGame(store, registry, tableId, "bob", 11).ok).toBe(false);
		expect(endGame(store, registry, tableId, "alice", 11)).toEqual({ ok: true });
		expect(getTable(store, tableId)?.meta.phase).toBe("finished");
		expect(viewOf(store, tableId, "bob")?.result).not.toBeNull();

		expect(setSeatNote(store, tableId, "bob", "信頼が大事")).toEqual({ ok: true });
		expect(listSeats(store, tableId)[1].meta.note).toBe("信頼が大事");

		expect(resetTable(store, tableId, "alice")).toEqual({ ok: true });
		const table = getTable(store, tableId);
		expect(table?.meta.phase).toBe("lobby");
		expect(table?.meta.snapshot).toBeNull();
		expect(listSeats(store, tableId)).toHaveLength(2);
	});

	it("keeps serving the view when the snapshot cannot be restored", () => {
		const { store, tableId } = setup();
		seatAll(store, tableId);
		startGame(store, registry, tableId, "alice", 10, 5);
		const table = getTable(store, tableId);
		store.updateShape(tableId, {
			meta: { ...table?.meta, snapshot: { ...table?.meta.snapshot, version: 999 } },
		} as Partial<ShapeData>);
		const view = viewOf(store, tableId, "alice");
		expect(view?.gameView).toBeNull();
		expect(
			dispatchAction(store, registry, tableId, "alice", "drawFromDeck", undefined, 11).ok,
		).toBe(false);
	});
});

describe("repairTables", () => {
	it("turns a copied table into a fresh lobby and drops copied seats", () => {
		const { store, tableId } = setup();
		seatAll(store, tableId);
		startGame(store, registry, tableId, "alice", 10, 5);
		const table = getTable(store, tableId) as ShapeData;
		const seat = listSeats(store, tableId)[0];
		// What copy/paste produces: new ids, same meta, parentId remapped.
		store.addShape({ ...table, id: "t2", x: 900 });
		store.addShape({ ...seat, id: "copied-seat", parentId: "t2" });

		repairTables(store);

		const copy = getTable(store, "t2");
		expect(copy?.meta).toMatchObject({ tableId: "t2", phase: "lobby", snapshot: null });
		// The copy keeps its host, so every client resets it the same way.
		expect(copy?.meta.hostUserId).toBe("alice");
		expect(store.getShape("copied-seat")).toBeUndefined();
		// The original is untouched.
		expect(getTable(store, tableId)?.meta.phase).toBe("playing");
		expect(listSeats(store, tableId)).toHaveLength(2);
	});

	it("only drops a seat without a table once that table was seen and removed", () => {
		const { store, tableId } = setup();
		seatAll(store, tableId);
		const seat = listSeats(store, tableId)[0];
		// A seat can arrive before its table while the board loads: keep it.
		store.addShape({ ...seat, id: "early", parentId: "later" });
		repairTables(store);
		expect(store.getShape("early")).toBeDefined();

		repairTables(store, new Set(["later"]));
		expect(store.getShape("early")).toBeUndefined();
	});

	it("drops a seat under a table whose id was not made by joinTable", () => {
		const { store, tableId } = setup();
		seatAll(store, tableId);
		const seat = listSeats(store, tableId)[0];
		store.addShape({ ...seat, id: "foreign", parentId: tableId });
		repairTables(store);
		expect(store.getShape("foreign")).toBeUndefined();
		expect(listSeats(store, tableId)).toHaveLength(2);
	});
});

describe("readers", () => {
	it("reject shapes whose meta is null", () => {
		const { store, tableId } = setup();
		seatAll(store, tableId);
		const table = getTable(store, tableId) as ShapeData;
		const seat = listSeats(store, tableId)[0];
		expect(isTable({ ...table, meta: null } as unknown as ShapeData)).toBe(false);
		expect(isSeat({ ...seat, meta: null } as unknown as ShapeData)).toBe(false);
	});
});

describe("games kept outside the table (bindGameState)", () => {
	function mapStore() {
		const values = new Map<string, unknown>();
		const observers = new Set<() => void>();
		const emit = () => {
			for (const o of observers) o();
		};
		const map: GameStateMap = {
			get: (k) => values.get(k),
			set: (k, v) => {
				values.set(k, v);
				emit();
			},
			delete: (k) => {
				values.delete(k);
				emit();
			},
			observe: (o) => observers.add(o),
			unobserve: (o) => observers.delete(o),
		};
		return { values, map };
	}

	it("plays from the map and leaves only the phase on the table", () => {
		const { store, tableId } = setup();
		const { values, map } = mapStore();
		const unbind = bindGameState(store, createMapGameState(map));
		seatAll(store, tableId);
		expect(startGame(store, registry, tableId, "alice", 10, 5)).toEqual({ ok: true });
		expect(getTable(store, tableId)?.meta).toMatchObject({ phase: "playing", snapshot: null });
		expect(values.has(tableId)).toBe(true);

		const tableBefore = getTable(store, tableId);
		expect(
			dispatchAction(store, registry, tableId, "alice", "drawFromDeck", undefined, 11),
		).toEqual({ ok: true });
		// A move inside the turn does not touch the table shape.
		expect(getTable(store, tableId)).toBe(tableBefore);
		expect(viewOf(store, tableId, "alice")?.stage).toBe("waitingForDiscard");

		resetTable(store, tableId, "alice");
		expect(values.has(tableId)).toBe(false);
		expect(getTable(store, tableId)?.meta.phase).toBe("lobby");
		unbind();
	});

	it("drops the game of a deleted table", () => {
		const { store, tableId } = setup();
		const { values, map } = mapStore();
		const unbind = bindGameState(store, createMapGameState(map));
		seatAll(store, tableId);
		startGame(store, registry, tableId, "alice", 10, 5);
		store.deleteShape(tableId);
		repairTables(store, new Set([tableId]));
		expect(values.has(tableId)).toBe(false);
		unbind();
	});
});
