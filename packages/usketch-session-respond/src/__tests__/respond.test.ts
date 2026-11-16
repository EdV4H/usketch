import { describe, expect, it } from "vitest";
import { arrangeResponses } from "../arrange.js";
import {
	createRespondConfig,
	parseRespond,
	parseRespondAction,
	RESPOND_MAX_TEXT,
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
