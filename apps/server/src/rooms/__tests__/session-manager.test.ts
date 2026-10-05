import type { ServerToClient, SessionView } from "@edv4h/usketch-session-protocol";
import { votingServerType } from "@edv4h/usketch-session-voting/server";
import { beforeEach, describe, expect, it } from "vitest";
import { SessionManager, type SessionSnapshot } from "../session-manager.js";

/** Assert-non-null helper (keeps tests free of `!`). */
function ok<T>(v: T | undefined | null): T {
	if (v == null) throw new Error("expected a value");
	return v;
}

/** Test harness: captures sends/broadcasts, controllable clock/ids/alarm. */
function harness(graceMs = 1000) {
	let clock = 1000;
	let idN = 0;
	let alarm: number | null = null;
	let snapshot: SessionSnapshot | undefined;
	const sent: { userId: string; msg: ServerToClient }[] = [];
	const broadcasts: ServerToClient[] = [];

	const mgr = new SessionManager({
		send: (userId, msg) => sent.push({ userId, msg }),
		broadcast: (msg) => broadcasts.push(msg),
		now: () => clock,
		genId: () => `s${++idN}`,
		persist: (s) => {
			snapshot = s;
		},
		setAlarm: (at) => {
			alarm = at;
		},
		graceMs,
		types: [votingServerType],
	});

	const lastBroadcastState = (): SessionView => {
		for (let i = broadcasts.length - 1; i >= 0; i--) {
			const b = broadcasts[i];
			if (b.t === "state") return b.session;
		}
		throw new Error("no state broadcast");
	};
	const privatesFor = (userId: string) =>
		sent.filter((s) => s.userId === userId && s.msg.t === "private").map((s) => s.msg);
	const errorsFor = (userId: string) =>
		sent.filter((s) => s.userId === userId && s.msg.t === "error").map((s) => s.msg);

	return {
		mgr,
		tick: (ms: number) => {
			clock += ms;
		},
		getAlarm: () => alarm,
		getSnapshot: () => snapshot,
		lastBroadcastState,
		privatesFor,
		errorsFor,
		sent,
		broadcasts,
	};
}

function createVote(
	h: ReturnType<typeof harness>,
	host: string,
	opts = ["A", "B", "C"],
	extra = {},
) {
	h.mgr.handle(host, {
		t: "create",
		config: { type: "voting", question: "Q?", options: opts, ...extra },
	});
	return h.lastBroadcastState().id;
}

describe("SessionManager — voting", () => {
	let h: ReturnType<typeof harness>;
	beforeEach(() => {
		h = harness();
	});

	it("creates a poll: broadcasts state, host is participant, host gets private", () => {
		const id = createVote(h, "host");
		const s = h.lastBroadcastState();
		expect(s.type).toBe("voting");
		expect(s.hostUserId).toBe("host");
		expect(s.participants.map((p) => p.userId)).toEqual(["host"]);
		expect((s.public as { tally: number[] }).tally).toEqual([0, 0, 0]);
		expect(h.privatesFor("host").length).toBe(1);
		expect(id).toBe("s1");
	});

	it("tallies votes and dedups per user (single-choice replaces)", () => {
		const id = createVote(h, "host");
		h.mgr.handle("u1", { t: "action", sessionId: id, action: { kind: "cast", optionIndex: 0 } });
		h.mgr.handle("u2", { t: "action", sessionId: id, action: { kind: "cast", optionIndex: 0 } });
		h.mgr.handle("u1", { t: "action", sessionId: id, action: { kind: "cast", optionIndex: 1 } }); // u1 re-votes → moves
		const pub = h.lastBroadcastState().public as { tally: number[]; totalVoters: number };
		expect(pub.tally).toEqual([1, 1, 0]); // u2→A, u1→B
		expect(pub.totalVoters).toBe(2);
	});

	it("multi-choice toggles options", () => {
		const id = createVote(h, "host", ["A", "B"], { multi: true });
		h.mgr.handle("u1", { t: "action", sessionId: id, action: { kind: "cast", optionIndex: 0 } });
		h.mgr.handle("u1", { t: "action", sessionId: id, action: { kind: "cast", optionIndex: 1 } });
		expect((h.lastBroadcastState().public as { tally: number[] }).tally).toEqual([1, 1]);
		h.mgr.handle("u1", { t: "action", sessionId: id, action: { kind: "cast", optionIndex: 0 } }); // toggle off A
		expect((h.lastBroadcastState().public as { tally: number[] }).tally).toEqual([0, 1]);
	});

	it("secret ballot never reveals who voted (public has tally only)", () => {
		const id = createVote(h, "host", ["A", "B"], { secret: true });
		h.mgr.handle("u1", { t: "action", sessionId: id, action: { kind: "cast", optionIndex: 0 } });
		const pub = h.lastBroadcastState().public;
		expect(JSON.stringify(pub)).not.toContain("u1"); // no voter identity leaks in public
		expect((pub as { tally: number[] }).tally).toEqual([1, 0]);
		// but u1's own private receipt knows their vote
		const priv = h.privatesFor("u1").at(-1) as { data: { myVotes: number[] } };
		expect(priv.data.myVotes).toEqual([0]);
	});

	it("rejects invalid option and closed poll", () => {
		const id = createVote(h, "host", ["A", "B"]);
		h.mgr.handle("u1", { t: "action", sessionId: id, action: { kind: "cast", optionIndex: 9 } });
		expect(h.errorsFor("u1").length).toBe(1);
		h.mgr.handle("host", { t: "close", sessionId: id });
		expect((h.lastBroadcastState().public as { status: string }).status).toBe("closed");
		h.mgr.handle("u2", { t: "action", sessionId: id, action: { kind: "cast", optionIndex: 0 } });
		expect(h.errorsFor("u2").length).toBe(1);
	});

	it("end is host-only and removes the session for everyone", () => {
		const id = createVote(h, "host");
		h.mgr.handle("intruder", { t: "end", sessionId: id });
		expect(h.errorsFor("intruder").length).toBe(1);
		expect(h.broadcasts.some((b) => b.t === "ended")).toBe(false);

		h.mgr.handle("host", { t: "end", sessionId: id });
		expect(h.broadcasts.some((b) => b.t === "ended" && b.sessionId === id)).toBe(true);
		// A late joiner no longer sees it.
		h.mgr.handle("late", { t: "sync" });
		expect(h.sent.find((s) => s.userId === "late" && s.msg.t === "state")).toBeUndefined();
	});

	it("close is host-only", () => {
		const id = createVote(h, "host");
		h.mgr.handle("intruder", { t: "close", sessionId: id });
		expect(h.errorsFor("intruder").length).toBe(1);
		expect((h.lastBroadcastState().public as { status: string }).status).toBe("open");
	});

	it("late joiner (sync) receives current state of active sessions", () => {
		const id = createVote(h, "host");
		h.mgr.handle("host", { t: "action", sessionId: id, action: { kind: "cast", optionIndex: 0 } });
		h.mgr.handle("late", { t: "sync" });
		const stateToLate = h.sent.find((s) => s.userId === "late" && s.msg.t === "state");
		expect(stateToLate).toBeTruthy();
		expect(
			((ok(stateToLate).msg as { session: SessionView }).session.public as { tally: number[] })
				.tally,
		).toEqual([1, 0, 0]);
	});
});

describe("SessionManager — presence / reconnect / host migration", () => {
	it("disconnect marks participant offline and arms grace alarm", () => {
		const h = harness(1000);
		const id = createVote(h, "host");
		h.mgr.handle("u1", { t: "join", sessionId: id });
		h.mgr.onDisconnect("u1");
		const p = ok(h.lastBroadcastState().participants.find((x) => x.userId === "u1"));
		expect(p.connected).toBe(false);
		expect(h.getAlarm()).toBe(1000 + 1000); // now(1000) + graceMs(1000)
	});

	it("reconnect (sync) within grace restores the participant and clears the alarm", () => {
		const h = harness(1000);
		const id = createVote(h, "host");
		h.mgr.handle("u1", { t: "join", sessionId: id });
		h.mgr.onDisconnect("u1");
		h.tick(500); // still within grace
		h.mgr.handle("u1", { t: "sync" });
		const p = ok(h.lastBroadcastState().participants.find((x) => x.userId === "u1"));
		expect(p.connected).toBe(true);
		expect(h.getAlarm()).toBeNull(); // no more pending grace
	});

	it("grace expiry forfeits the participant; host migrates to earliest connected peer", () => {
		const h = harness(1000);
		const id = createVote(h, "host");
		h.mgr.handle("u1", { t: "join", sessionId: id });
		h.mgr.onDisconnect("host");
		h.tick(1001); // past grace
		h.mgr.onAlarm();
		const s = h.lastBroadcastState();
		expect(s.participants.map((p) => p.userId)).toEqual(["u1"]); // host removed
		expect(s.hostUserId).toBe("u1"); // migrated
	});

	it("a still-connected other tab keeps the user present (onDisconnect only on last)", () => {
		// onDisconnect is called by the adapter only when the user's LAST socket closes,
		// so a single call === last tab. Here we assert no forfeit before the alarm.
		const h = harness(1000);
		const id = createVote(h, "host");
		h.mgr.handle("u1", { t: "join", sessionId: id });
		h.mgr.onDisconnect("u1");
		h.tick(500);
		h.mgr.onAlarm(); // fires early → nothing expired yet
		expect(h.lastBroadcastState().participants.some((p) => p.userId === "u1")).toBe(true);
	});

	it("snapshot round-trips through restore", () => {
		const h = harness();
		const id = createVote(h, "host");
		h.mgr.handle("u1", { t: "action", sessionId: id, action: { kind: "cast", optionIndex: 1 } });
		const snap = ok(h.getSnapshot());

		const h2 = harness();
		h2.mgr.restore(snap);
		h2.mgr.handle("late", { t: "sync" });
		const stateToLate = h2.sent.find((s) => s.userId === "late" && s.msg.t === "state");
		expect(
			((ok(stateToLate).msg as { session: SessionView }).session.public as { tally: number[] })
				.tally,
		).toEqual([0, 1, 0]);
	});
});
