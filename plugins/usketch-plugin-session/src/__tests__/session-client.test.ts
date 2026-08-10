import type { ServerToClient, SessionView } from "@edv4h/usketch-session-protocol";
import type { WsConnectionStatus, WsProviderHandle } from "@edv4h/usketch-sync";
import { beforeEach, describe, expect, it } from "vitest";
import { createSessionClient } from "../session-client.js";

/**
 * Minimal fake WsProvider exposing just the session channel + status hooks the
 * client uses. Captures every outbound `sendSession` frame and lets the test
 * push server messages and connection transitions.
 */
function fakeWs(connected = true) {
	const sent: Record<string, unknown>[] = [];
	let sessionHandler: ((msg: Record<string, unknown>) => void) | undefined;
	let statusHandler: ((s: WsConnectionStatus) => void) | undefined;

	const handle = {
		connected,
		sendSession: (msg: Record<string, unknown>) => sent.push(msg),
		onSession: (h: (msg: Record<string, unknown>) => void) => {
			sessionHandler = h;
			return () => {
				sessionHandler = undefined;
			};
		},
		onStatusChange: (h: (s: WsConnectionStatus) => void) => {
			statusHandler = h;
			return () => {
				statusHandler = undefined;
			};
		},
	} as unknown as WsProviderHandle;

	return {
		handle,
		sent,
		push: (msg: ServerToClient) => sessionHandler?.(msg as unknown as Record<string, unknown>),
		setStatus: (s: WsConnectionStatus) => statusHandler?.(s),
	};
}

function view(over: Partial<SessionView> = {}): SessionView {
	return {
		id: "s1",
		type: "voting",
		hostUserId: "host",
		status: "active",
		createdAt: 1000,
		participants: [{ userId: "host", role: "host", joinedAt: 1000, connected: true }],
		public: {
			type: "voting",
			question: "Q?",
			options: ["A", "B"],
			tally: [0, 0],
			totalVoters: 0,
			secret: false,
			multi: false,
			status: "open",
		},
		...over,
	};
}

describe("createSessionClient", () => {
	let ws: ReturnType<typeof fakeWs>;

	beforeEach(() => {
		ws = fakeWs(true);
	});

	it("sends an initial sync when already connected", () => {
		createSessionClient(ws.handle);
		expect(ws.sent).toEqual([{ t: "sync" }]);
	});

	it("does not sync at construction when disconnected, but syncs on connect", () => {
		const offline = fakeWs(false);
		createSessionClient(offline.handle);
		expect(offline.sent).toEqual([]);
		offline.setStatus("connected");
		expect(offline.sent).toEqual([{ t: "sync" }]);
	});

	it("mirrors state broadcasts and notifies subscribers", () => {
		const client = createSessionClient(ws.handle);
		let ticks = 0;
		client.subscribe(() => ticks++);
		ws.push({ t: "state", session: view() });
		expect(ticks).toBe(1);
		expect(client.getState().sessions.map((s) => s.id)).toEqual(["s1"]);
	});

	it("sorts sessions oldest-first by createdAt", () => {
		const client = createSessionClient(ws.handle);
		ws.push({ t: "state", session: view({ id: "late", createdAt: 3000 }) });
		ws.push({ t: "state", session: view({ id: "early", createdAt: 500 }) });
		expect(client.getState().sessions.map((s) => s.id)).toEqual(["early", "late"]);
	});

	it("stores my private receipt keyed by sessionId", () => {
		const client = createSessionClient(ws.handle);
		ws.push({ t: "private", sessionId: "s1", data: { type: "voting", myVotes: [1] } });
		expect(client.getState().privates.s1).toEqual({ type: "voting", myVotes: [1] });
	});

	it("removes a session on `ended` and drops its private", () => {
		const client = createSessionClient(ws.handle);
		ws.push({ t: "state", session: view() });
		ws.push({ t: "private", sessionId: "s1", data: { type: "voting", myVotes: [0] } });
		ws.push({ t: "ended", sessionId: "s1" });
		expect(client.getState().sessions).toEqual([]);
		expect(client.getState().privates.s1).toBeUndefined();
	});

	it("treats a state with status='ended' as a removal", () => {
		const client = createSessionClient(ws.handle);
		ws.push({ t: "state", session: view() });
		ws.push({ t: "state", session: view({ status: "ended" }) });
		expect(client.getState().sessions).toEqual([]);
	});

	it("surfaces server errors and clears them on the next state", () => {
		const client = createSessionClient(ws.handle);
		ws.push({ t: "error", message: "投票は締め切られています" });
		expect(client.getState().error).toBe("投票は締め切られています");
		ws.push({ t: "state", session: view() });
		expect(client.getState().error).toBeNull();
	});

	it("emits the correct outbound frames for create/vote/close/end", () => {
		const client = createSessionClient(ws.handle);
		ws.sent.length = 0; // drop the initial sync
		client.create({
			type: "voting",
			question: "Q?",
			options: ["A", "B"],
			secret: true,
			multi: false,
		});
		client.vote("s1", 1);
		client.close("s1");
		client.end("s1");
		expect(ws.sent).toEqual([
			{
				t: "create",
				config: { type: "voting", question: "Q?", options: ["A", "B"], secret: true, multi: false },
			},
			{ t: "action", sessionId: "s1", action: { kind: "cast", optionIndex: 1 } },
			{ t: "close", sessionId: "s1" },
			{ t: "end", sessionId: "s1" },
		]);
	});

	it("stops mirroring after dispose", () => {
		const client = createSessionClient(ws.handle);
		client.dispose();
		ws.push({ t: "state", session: view() });
		expect(client.getState().sessions).toEqual([]);
	});
});
