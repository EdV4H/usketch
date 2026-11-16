import { describe, expect, it } from "vitest";
import { arrangeResponses } from "../arrange.js";
import {
	createRespondConfig,
	flattenResponseParts,
	parseRespond,
	parseRespondAction,
	RESPOND_MAX_PARTS_LIMIT,
	RESPOND_MAX_TEXT,
	RESPOND_MAX_TEXT_LIMIT,
} from "../respond.js";
import { respondServerType } from "../server.js";

describe("createRespondConfig / parseRespond", () => {
	it("お題を整え、空や長すぎるものは作らない", () => {
		const c = createRespondConfig({ prompt: " Q ", hostName: "H" }, 10);
		expect(c).toMatchObject({ type: "respond", prompt: "Q", hostName: "H", startedAt: 10 });
		expect(createRespondConfig({ prompt: " " }, 0)).toBeNull();
		expect(createRespondConfig({ prompt: "x".repeat(RESPOND_MAX_TEXT + 1) }, 0)).toBeNull();
	});

	it("壊れた値は null、壊れた答えは落とす", () => {
		expect(parseRespond(null)).toBeNull();
		expect(parseRespond({ prompt: "Q", startedAt: "1", expiresAt: 2 })).toBeNull();
		const r = parseRespond({
			prompt: "Q",
			startedAt: 1,
			expiresAt: 2,
			answeredUserIds: ["a", 3],
			revealed: true,
			answers: [{ userId: "a", text: "x", tag: "t" }, { userId: "b", text: "" }, null],
		});
		expect(r?.answeredUserIds).toEqual(["a"]);
		expect(r?.answers).toEqual([{ userId: "a", text: "x", tag: "t" }]);
	});

	it("操作は submit と retract だけ読む", () => {
		expect(parseRespondAction({ kind: "submit", text: " a ", tag: " t " })).toEqual({
			kind: "submit",
			text: "a",
			tag: "t",
		});
		expect(parseRespondAction({ kind: "submit", text: "a", tag: "" })).toBeNull();
		expect(parseRespondAction({ kind: "submit", text: "" })).toBeNull();
		expect(parseRespondAction({ kind: "retract" })).toEqual({ kind: "retract" });
		expect(parseRespondAction({ kind: "reveal" })).toBeNull();
	});

	it("maxText と maxParts は範囲に収め、無ければ 280 字・かけら無し", () => {
		expect(createRespondConfig({ prompt: "Q" }, 0)).toMatchObject({ maxText: 280, maxParts: 0 });
		expect(createRespondConfig({ prompt: "Q", maxText: 1000, maxParts: 20 }, 0)).toMatchObject({
			maxText: 1000,
			maxParts: 20,
		});
		expect(
			createRespondConfig({ prompt: "Q", maxText: RESPOND_MAX_TEXT_LIMIT + 1, maxParts: -1 }, 0),
		).toMatchObject({ maxText: 280, maxParts: 0 });
		// 以前の公開状態 (maxText / maxParts 無し) も読める
		expect(parseRespond({ prompt: "Q", startedAt: 1, expiresAt: 2 })).toMatchObject({
			maxText: 280,
			maxParts: 0,
		});
	});

	it("submit の parts は全部正しいときだけ読む", () => {
		expect(
			parseRespondAction({
				kind: "submit",
				text: "a b",
				parts: [{ text: " a ", tag: "joy" }, { text: "b" }],
			}),
		).toEqual({ kind: "submit", text: "a b", parts: [{ text: "a", tag: "joy" }, { text: "b" }] });
		expect(parseRespondAction({ kind: "submit", text: "a", parts: [{ text: "" }] })).toBeNull();
		expect(parseRespondAction({ kind: "submit", text: "a", parts: "a" })).toBeNull();
		expect(
			parseRespondAction({
				kind: "submit",
				text: "a",
				parts: Array.from({ length: RESPOND_MAX_PARTS_LIMIT + 1 }, () => ({ text: "x" })),
			}),
		).toBeNull();
		// 空の parts は付けない
		expect(parseRespondAction({ kind: "submit", text: "a", parts: [] })).toEqual({
			kind: "submit",
			text: "a",
		});
	});

	it("flattenResponseParts はかけらを 1 つずつの答えに開く", () => {
		expect(
			flattenResponseParts([
				{ userId: "u1", text: "a b", parts: [{ text: "a", tag: "joy" }, { text: "b" }] },
				{ userId: "u2", text: "c", tag: "sad" },
			]),
		).toEqual([
			{ userId: "u1", text: "a", tag: "joy" },
			{ userId: "u1", text: "b" },
			{ userId: "u2", text: "c", tag: "sad" },
		]);
	});
});

describe("respondServerType", () => {
	const fresh = () => {
		const config = createRespondConfig({ prompt: "Q" }, 0);
		if (!config) throw new Error("config");
		return respondServerType.init(config);
	};

	it("答えは secret に置き、公開されるのは答えた人の順番だけ", () => {
		const s = fresh();
		expect(respondServerType.reduce(s, { kind: "submit", text: "a" }, "u1")).toBeUndefined();
		expect(respondServerType.reduce(s, { kind: "submit", text: "b" }, "u2")).toBeUndefined();
		expect(respondServerType.reduce(s, { kind: "submit", text: "a2" }, "u1")).toBeUndefined();
		expect(s.public.answeredUserIds).toEqual(["u1", "u2"]);
		expect(s.public.answers).toEqual([]);
		expect(respondServerType.privateFor(s, "u1")).toEqual({ mine: { userId: "u1", text: "a2" } });
		expect(respondServerType.privateFor(s, "u3")).toEqual({ mine: null });
	});

	it("close で公開し、そのあとは答えを受け付けない", () => {
		const s = fresh();
		respondServerType.reduce(s, { kind: "submit", text: "a" }, "u1");
		respondServerType.close?.(s);
		expect(s.public.revealed).toBe(true);
		expect(s.public.answers).toEqual([{ userId: "u1", text: "a" }]);
		expect(respondServerType.reduce(s, { kind: "submit", text: "b" }, "u2")).toBeTypeOf("string");
		expect(respondServerType.reduce(s, { kind: "retract" }, "u1")).toBeTypeOf("string");
	});

	it("長すぎる答え・多すぎるかけらは断り、許されたかけらは持ち、まとめで出す", () => {
		const s = fresh();
		expect(respondServerType.reduce(s, { kind: "submit", text: "x".repeat(281) }, "u1")).toBe(
			"answer is too long",
		);
		expect(
			respondServerType.reduce(s, { kind: "submit", text: "a", parts: [{ text: "a" }] }, "u1"),
		).toBe("too many parts");

		const config = createRespondConfig({ prompt: "Q", maxText: 1000, maxParts: 2 }, 0);
		if (!config) throw new Error("config");
		const t = respondServerType.init(config);
		expect(respondServerType.reduce(t, { kind: "submit", text: "x".repeat(900) }, "u1")).toBe(
			undefined,
		);
		const parts = [{ text: "a", tag: "joy" }, { text: "b" }];
		expect(respondServerType.reduce(t, { kind: "submit", text: "a b", parts }, "u2")).toBe(
			undefined,
		);
		expect(
			respondServerType.reduce(
				t,
				{ kind: "submit", text: "a", parts: [...parts, { text: "c" }] },
				"u2",
			),
		).toBe("too many parts");
		expect(respondServerType.privateFor(t, "u2")).toEqual({
			mine: { userId: "u2", text: "a b", parts },
		});
		respondServerType.close?.(t);
		expect(parseRespond(t.public)?.answers.at(1)).toEqual({ userId: "u2", text: "a b", parts });
	});

	it("答えていない人の取り下げ・不正な操作は断る", () => {
		const s = fresh();
		expect(respondServerType.reduce(s, { kind: "retract" }, "u1")).toBeTypeOf("string");
		expect(respondServerType.reduce(s, { kind: "nope" }, "u1")).toBeTypeOf("string");
	});
});

describe("arrangeResponses", () => {
	const area = { x: 100, y: 200, width: 400, height: 300 };

	it("幅に入るだけの列で、答えた順に並べる", () => {
		// (400 - 16) / (100 + 16) = 3 列
		const placed = arrangeResponses(["a", "b", "c", "d"], {
			area,
			itemWidth: 100,
			itemHeight: 50,
		});
		expect(placed.map((p) => [p.item, p.x, p.y])).toEqual([
			["a", 116, 216],
			["b", 232, 216],
			["c", 348, 216],
			["d", 116, 282],
		]);
	});

	it("グループごとに行を分け、グループの無いものは最後", () => {
		const items = [{ id: 1, tag: "sad" }, { id: 2 }, { id: 3, tag: "joy" }, { id: 4, tag: "sad" }];
		const placed = arrangeResponses(items, {
			area,
			itemWidth: 100,
			itemHeight: 50,
			groupOf: (i) => i.tag,
			groupOrder: ["joy"],
		});
		expect(placed.map((p) => [p.item.id, p.group, p.y])).toEqual([
			[3, "joy", 216],
			[1, "sad", 282],
			[4, "sad", 282],
			[2, undefined, 348],
		]);
	});

	it("狭くても 1 列は置く", () => {
		const placed = arrangeResponses(["a", "b"], {
			area: { ...area, width: 10 },
			itemWidth: 100,
			itemHeight: 50,
			gap: 0,
		});
		expect(placed.map((p) => p.y)).toEqual([200, 250]);
	});
});
