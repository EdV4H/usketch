import { describe, expect, it } from "vitest";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness";
import * as Y from "yjs";
import { broadcastPageOf, parseAwarenessUpdate } from "../page-filter.js";

function client(state: Record<string, unknown>, clientId?: number): Awareness {
	const doc = new Y.Doc();
	if (clientId !== undefined) doc.clientID = clientId;
	const awareness = new Awareness(doc);
	awareness.setLocalState(state);
	return awareness;
}

/** 2 人分の状態を 1 つの update にする（サーバーが中継する形）。 */
function updateOf(...clients: Awareness[]): { update: Uint8Array; ids: number[] } {
	const merged = new Awareness(new Y.Doc());
	for (const c of clients) {
		applyAwarenessUpdate(merged, encodeAwarenessUpdate(c, [c.clientID]), "remote");
	}
	const ids = clients.map((c) => c.clientID);
	return { update: encodeAwarenessUpdate(merged, ids), ids };
}

describe("parseAwarenessUpdate", () => {
	it("見られないページにいる人の状態を null にする", () => {
		const onPublic = client({ page: "public", user: { name: "A" } });
		const onPrivate = client({ page: "secret", user: { name: "B" } });
		const { update } = updateOf(onPublic, onPrivate);

		const parsed = parseAwarenessUpdate(update);
		expect(parsed?.pages.sort()).toEqual(["public", "secret"]);

		const receiver = new Awareness(new Y.Doc());
		applyAwarenessUpdate(
			receiver,
			parsed?.forViewer((page) => page !== "secret") ?? update,
			"remote",
		);
		expect(receiver.getStates().get(onPublic.clientID)).toMatchObject({ page: "public" });
		expect(receiver.getStates().has(onPrivate.clientID)).toBe(false);
	});

	it("前に見えていた状態も、見られないページへ移ったら消える", () => {
		const mover = client({ page: "public" });
		const receiver = new Awareness(new Y.Doc());
		applyAwarenessUpdate(receiver, encodeAwarenessUpdate(mover, [mover.clientID]), "remote");
		expect(receiver.getStates().has(mover.clientID)).toBe(true);

		mover.setLocalStateField("page", "secret");
		const parsed = parseAwarenessUpdate(encodeAwarenessUpdate(mover, [mover.clientID]));
		applyAwarenessUpdate(receiver, parsed?.forViewer(() => false) ?? new Uint8Array(), "remote");
		expect(receiver.getStates().has(mover.clientID)).toBe(false);
	});

	it("全部見られるなら元の update をそのまま返す", () => {
		const { update } = updateOf(client({ page: "a" }), client({ cursor: { x: 1 } }));
		const parsed = parseAwarenessUpdate(update);
		expect(parsed?.forViewer(() => true)).toBe(update);
	});

	it("大きな clientID と日本語の状態も読み書きできる", () => {
		const big = client({ page: "secret", user: { name: "まるちゃん" } }, 4_294_967_295);
		const ok = client({ page: "public", user: { name: "ゲスト" } });
		const { update } = updateOf(big, ok);
		const filtered = parseAwarenessUpdate(update)?.forViewer((p) => p === "public");
		const receiver = new Awareness(new Y.Doc());
		applyAwarenessUpdate(receiver, filtered ?? new Uint8Array(), "remote");
		expect(receiver.getStates().get(ok.clientID)).toMatchObject({ user: { name: "ゲスト" } });
		expect(receiver.getStates().has(big.clientID)).toBe(false);
	});

	it("壊れた update は null", () => {
		expect(parseAwarenessUpdate(new Uint8Array([5, 1]))).toBeNull();
	});
});

describe("broadcastPageOf", () => {
	const encode = (msg: unknown) => new TextEncoder().encode(JSON.stringify(msg));

	it("送り主のページを読む", () => {
		expect(broadcastPageOf(encode({ type: "ping", __page: "p1" }))).toBe("p1");
	});

	it("ページが無い・読めないなら null", () => {
		expect(broadcastPageOf(encode({ type: "ping" }))).toBeNull();
		expect(broadcastPageOf(new Uint8Array([0xff]))).toBeNull();
	});
});
