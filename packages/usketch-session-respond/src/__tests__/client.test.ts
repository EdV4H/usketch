import { createYjsSessionClient } from "@edv4h/usketch-plugin-session";
import type { BoardStore, EventBus, ServiceRegistry } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createRespondClientType, flattenResponseParts, getRespondApi } from "../client.js";
import { RESPOND_MAX_MS } from "../respond.js";
import { respondServerType } from "../server.js";

let clock = 1_000_000;
const now = () => clock;

/** Two linked docs, like peers in one y-websocket room. */
function linkedDocs() {
	const a = new Y.Doc();
	const b = new Y.Doc();
	a.on("update", (u: Uint8Array, origin: unknown) => {
		if (origin !== "remote") Y.applyUpdate(b, u, "remote");
	});
	b.on("update", (u: Uint8Array, origin: unknown) => {
		if (origin !== "remote") Y.applyUpdate(a, u, "remote");
	});
	return { a, b };
}

function fakeServices(): ServiceRegistry {
	const map = new Map<string, unknown>();
	return {
		provide(key, service) {
			map.set(key, service);
			return () => map.delete(key);
		},
		get: <T>(key: string) => map.get(key) as T | undefined,
		has: (key) => map.has(key),
	};
}

let ids = 0;
function board(doc: Y.Doc, userId: string) {
	const client = createYjsSessionClient({
		doc,
		userId,
		types: [respondServerType],
		now,
		genId: () => `r${ids++}`,
	});
	const services = fakeServices();
	const detach = createRespondClientType({ now }).attach?.({
		client,
		userId,
		store: {} as BoardStore,
		services,
		events: { on: () => () => {}, emit: () => {} } as unknown as EventBus,
	});
	const api = () => {
		const a = getRespondApi(services);
		if (!a) throw new Error("respond service missing");
		return a;
	};
	return { client, api, detach };
}

describe("respond client", () => {
	it("答えは自分にだけ見え、主催者がまとめると全員に見える", () => {
		const { a, b } = linkedDocs();
		const host = board(a, "host");
		const guest = board(b, "guest");
		expect(host.api().start({ prompt: "いまの気持ちは？", hostName: "Host" })).toBe(true);

		expect(guest.api().getState().respond?.prompt).toBe("いまの気持ちは？");
		expect(guest.api().getState().isHost).toBe(false);

		guest.api().submit("たのしい", "joy");
		expect(guest.api().getState().mine).toEqual({ userId: "guest", text: "たのしい", tag: "joy" });
		// 主催者には数だけ届く
		expect(host.api().getState().answeredCount).toBe(1);
		expect(host.api().getState().mine).toBeNull();
		expect(host.api().getState().respond?.answers).toEqual([]);

		// 直すと差し替わり、数は変わらない
		guest.api().submit("ちょっと眠い");
		expect(guest.api().getState().mine?.text).toBe("ちょっと眠い");
		expect(host.api().getState().answeredCount).toBe(1);

		host.api().submit("わくわく", "joy");
		expect(guest.api().getState().answeredCount).toBe(2);

		// 主催者以外はまとめられない
		guest.api().reveal();
		expect(guest.api().getState().respond?.revealed).toBe(false);

		host.api().reveal();
		const shown = guest.api().getState().respond;
		expect(shown?.revealed).toBe(true);
		expect(shown?.answers).toEqual([
			{ userId: "guest", text: "ちょっと眠い" },
			{ userId: "host", text: "わくわく", tag: "joy" },
		]);
		// まとめたあとは答えられない
		guest.api().submit("やっぱり楽しい");
		expect(guest.api().getState().mine?.text).toBe("ちょっと眠い");
	});

	it("かけらつきの答えを出せ、まとめで 1 つずつに開ける", () => {
		const { a, b } = linkedDocs();
		const host = board(a, "host");
		const guest = board(b, "guest");
		host.api().start({ prompt: "Q", maxText: 1000, maxParts: 5 });
		expect(guest.api().getState().respond).toMatchObject({ maxText: 1000, maxParts: 5 });
		guest.api().submit("楽しい。眠い。", undefined, [
			{ text: "楽しい", tag: "joy" },
			{ text: "眠い", tag: "tired" },
		]);
		expect(guest.api().getState().mine?.parts).toHaveLength(2);
		host.api().reveal();
		expect(flattenResponseParts(host.api().getState().respond?.answers ?? [])).toEqual([
			{ userId: "guest", text: "楽しい", tag: "joy" },
			{ userId: "guest", text: "眠い", tag: "tired" },
		]);
	});

	it("取り下げると数が減る", () => {
		const { a, b } = linkedDocs();
		const host = board(a, "host");
		const guest = board(b, "guest");
		host.api().start({ prompt: "Q" });
		guest.api().submit("A");
		expect(host.api().getState().answeredCount).toBe(1);
		guest.api().retract();
		expect(host.api().getState().answeredCount).toBe(0);
		expect(guest.api().getState().mine).toBeNull();
	});

	it("お題が空なら始めない。始め直すと自分の前の問いは終わる", () => {
		const { a, b } = linkedDocs();
		const host = board(a, "host");
		const guest = board(b, "guest");
		expect(host.api().start({ prompt: "  " })).toBe(false);
		expect(guest.api().getState().respond).toBeNull();

		host.api().start({ prompt: "1" });
		host.api().start({ prompt: "2" });
		expect(guest.client.getState().sessions).toHaveLength(1);
		expect(guest.api().getState().respond?.prompt).toBe("2");
	});

	it("主催者が終えると全員から消え、安全弁を過ぎると主催者の端末が消す", () => {
		const { a, b } = linkedDocs();
		const host = board(a, "host");
		const guest = board(b, "guest");
		host.api().start({ prompt: "Q" });
		guest.api().end();
		expect(host.api().getState().respond).not.toBeNull();
		host.api().end();
		expect(guest.api().getState().respond).toBeNull();

		host.api().start({ prompt: "Q2" });
		clock += RESPOND_MAX_MS;
		host.client.sync();
		guest.api().submit("late");
		expect(guest.client.getState().sessions).toHaveLength(0);
	});
});
