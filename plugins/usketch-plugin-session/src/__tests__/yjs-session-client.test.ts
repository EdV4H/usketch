import type { ServerSessionType, SessionConfig } from "@edv4h/usketch-session-protocol";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import type { SessionClient } from "../session-client.js";
import { createYjsSessionClient, YJS_SESSIONS_MAP } from "../yjs-session-client.js";

/** A public counter: anyone adds, a cap rejects, the host can close it. */
type CounterPublic = { count: number; max: number; by: string[]; closed: boolean };
const counterType: ServerSessionType<
	CounterPublic,
	null,
	SessionConfig & { max?: number },
	{ kind: "add" }
> = {
	type: "counter",
	init: (config) => ({
		public: { count: 0, max: config.max ?? 10, by: [], closed: false },
		secret: null,
	}),
	reduce(state, action, actor) {
		if (action.kind !== "add") return "unknown action";
		if (state.public.closed) return "closed";
		if (state.public.count >= state.public.max) return "full";
		state.public.count++;
		state.public.by.push(actor);
		return undefined;
	},
	privateFor: (state, userId) => ({ mine: state.public.by.filter((b) => b === userId).length }),
	close(state) {
		state.public.closed = true;
	},
};

const secretType: ServerSessionType = {
	type: "secret-poll",
	requiresServer: (config) => !!config.secret,
	init: () => ({ public: {}, secret: {} }),
	reduce: () => undefined,
	privateFor: () => null,
};

/** Two peers whose docs exchange updates immediately, like a live y-websocket room. */
function peers() {
	const a = new Y.Doc();
	const b = new Y.Doc();
	a.on("update", (u: Uint8Array, origin: unknown) => {
		if (origin !== "remote") Y.applyUpdate(b, u, "remote");
	});
	b.on("update", (u: Uint8Array, origin: unknown) => {
		if (origin !== "remote") Y.applyUpdate(a, u, "remote");
	});
	let n = 0;
	const client = (doc: Y.Doc, userId: string, extra = {}) =>
		createYjsSessionClient({
			doc,
			userId,
			types: [counterType, secretType],
			now: () => 1000 + n++,
			genId: () => `s${n++}`,
			...extra,
		});
	return { a, b, client };
}

const only = (c: SessionClient) => {
	const [s] = c.getState().sessions;
	if (!s) throw new Error("no session");
	return s;
};

describe("createYjsSessionClient", () => {
	it("作ったセッションがほかの端末にも見え、操作が全員に届く", () => {
		const { a, b, client } = peers();
		const host = client(a, "host");
		const guest = client(b, "guest");
		host.create({ type: "counter" });
		const s = only(guest);
		expect(s.hostUserId).toBe("host");
		guest.act(s.id, { kind: "add" });
		host.act(s.id, { kind: "add" });
		expect((only(host).public as CounterPublic).count).toBe(2);
		expect(only(host).participants.map((p) => p.userId)).toEqual(["host", "guest"]);
		expect(guest.getState().privates[s.id]).toEqual({ mine: 1 });
	});

	it("同時の操作は上書きし合わず、どちらも残る", () => {
		const a = new Y.Doc();
		const b = new Y.Doc();
		const host = createYjsSessionClient({ doc: a, userId: "host", types: [counterType] });
		host.create({ type: "counter" });
		Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
		const guest = createYjsSessionClient({ doc: b, userId: "guest", types: [counterType] });
		const id = only(host).id;
		// オフラインのまま両方で足してから、まとめて同期する。
		host.act(id, { kind: "add" });
		guest.act(id, { kind: "add" });
		Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
		Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
		expect((only(host).public as CounterPublic).count).toBe(2);
		expect(only(host).public).toEqual(only(guest).public);
	});

	it("型が断った操作はログに入れず、エラーを返す", () => {
		const { a, client } = peers();
		const host = client(a, "host");
		host.create({ type: "counter", max: 1 });
		const id = only(host).id;
		host.act(id, { kind: "add" });
		host.act(id, { kind: "add" });
		expect(host.getState().error).toBe("full");
		expect(a.getMap<Y.Array<unknown>>(YJS_SESSIONS_MAP).get(id)?.length).toBe(2);
	});

	it("閉じる・終えるは主催者だけ", () => {
		const { a, b, client } = peers();
		const host = client(a, "host");
		const guest = client(b, "guest");
		host.create({ type: "counter" });
		const id = only(guest).id;
		guest.close(id);
		expect(guest.getState().error).toBe("host only");
		host.close(id);
		expect((only(guest).public as CounterPublic).closed).toBe(true);
		guest.end(id);
		expect(guest.getState().sessions).toHaveLength(1);
		host.end(id);
		expect(guest.getState().sessions).toHaveLength(0);
	});

	it("主催者が離れたら、いちばん早く入った人が主催者になる。最後の人が離れたら終わる", () => {
		const { a, b, client } = peers();
		const host = client(a, "host");
		const guest = client(b, "guest");
		host.create({ type: "counter" });
		const id = only(guest).id;
		guest.join(id);
		host.leave(id);
		expect(only(guest).hostUserId).toBe("guest");
		guest.leave(id);
		expect(guest.getState().sessions).toHaveLength(0);
		expect(a.getMap(YJS_SESSIONS_MAP).has(id)).toBe(false);
	});

	it("サーバーが要る型は作れない", () => {
		const { a, client } = peers();
		const host = client(a, "host");
		host.create({ type: "secret-poll", secret: true });
		expect(host.getState().sessions).toHaveLength(0);
		expect(host.getState().error).toMatch(/session server/);
		host.create({ type: "secret-poll", secret: false });
		expect(host.getState().sessions).toHaveLength(1);
	});

	it("presence があれば、いない人は connected: false になる", () => {
		const { a, client } = peers();
		const states = new Map<number, unknown>([[1, { user: { id: "host" } }]]);
		const listeners = new Set<() => void>();
		const presence = {
			getStates: () => states,
			on: (_: "change", l: () => void) => listeners.add(l),
			off: (_: "change", l: () => void) => listeners.delete(l),
		};
		const host = client(a, "host", { presence });
		host.create({ type: "counter" });
		host.act(only(host).id, { kind: "add" });
		// guest の操作を host の doc に直接書いた体にする。
		const log = a.getMap<Y.Array<unknown>>(YJS_SESSIONS_MAP).get(only(host).id);
		log?.push([{ t: "join", by: "guest", at: 2000 }]);
		const connected = () =>
			Object.fromEntries(only(host).participants.map((p) => [p.userId, p.connected]));
		expect(connected()).toEqual({ host: true, guest: false });
		states.set(2, { user: { id: "guest" } });
		for (const l of listeners) l();
		expect(connected()).toEqual({ host: true, guest: true });
	});

	it("主催者がいないあいだは、ほかの人が主催者を引き継げる (いるあいだは引き継げない)", () => {
		const { a, b, client } = peers();
		const states = new Map<number, unknown>([
			[1, { user: { id: "host" } }],
			[2, { user: { id: "guest" } }],
		]);
		const listeners = new Set<() => void>();
		const presence = {
			getStates: () => states,
			on: (_: "change", l: () => void) => listeners.add(l),
			off: (_: "change", l: () => void) => listeners.delete(l),
		};
		const changed = () => {
			for (const l of listeners) l();
		};
		const host = client(a, "host", { presence });
		const guest = client(b, "guest", { presence });
		host.create({ type: "counter" });
		const id = only(host).id;
		guest.join(id);

		guest.claimHost(id);
		expect(only(guest).hostUserId).toBe("host");
		expect(guest.getState().error).toBe("the host is here");

		states.delete(1);
		changed();
		guest.claimHost(id);
		expect(only(host).hostUserId).toBe("guest");
		expect(Object.fromEntries(only(host).participants.map((p) => [p.userId, p.role]))).toEqual({
			host: "participant",
			guest: "host",
		});
		// 主催者だけの操作は引き継いだ人のものになる
		host.close(id);
		expect(host.getState().error).toBe("host only");
		guest.close(id);
		expect(only(host).public).toMatchObject({ closed: true });

		// 元の主催者が戻っても、参加者のまま
		states.set(1, { user: { id: "host" } });
		changed();
		expect(only(host).hostUserId).toBe("guest");
	});

	it("presence が無ければ、主催者は引き継げない", () => {
		const { a, b, client } = peers();
		const host = client(a, "host");
		const guest = client(b, "guest");
		host.create({ type: "counter" });
		guest.claimHost(only(guest).id);
		expect(only(host).hostUserId).toBe("host");
	});

	it("知らない型のログは無視する", () => {
		const { a, client } = peers();
		const log = new Y.Array();
		log.push([{ t: "create", by: "x", at: 1, config: { type: "nope" } }]);
		a.getMap(YJS_SESSIONS_MAP).set("x", log);
		expect(client(a, "host").getState().sessions).toHaveLength(0);
	});
});
