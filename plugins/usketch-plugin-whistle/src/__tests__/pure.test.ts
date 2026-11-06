import { describe, expect, it } from "vitest";
import { edgePosition } from "../edge-position.js";
import { parseWhistleKind, resolveMovement } from "../kinds.js";
import { DEFAULT_WHISTLE_LABELS, displayName, resolveLabels } from "../labels.js";
import { parseWhistleMessage } from "../messages.js";
import { planSwoop } from "../viewport-moves.js";

const SIZE = { width: 1000, height: 800 };

describe("kinds", () => {
	it("未知の kind はおーい", () => {
		expect(parseWhistleKind(undefined)).toBe("call");
		expect(parseWhistleKind("nope")).toBe("call");
		expect(parseWhistleKind("follow")).toBe("follow");
	});

	it("強制移動を受けられないと auto / follow は prompt に落ちる", () => {
		expect(resolveMovement("assemble", true)).toBe("auto");
		expect(resolveMovement("assemble", false)).toBe("prompt");
		expect(resolveMovement("follow", false)).toBe("prompt");
		expect(resolveMovement("call", false)).toBe("none");
	});

	it("動き方は host が差し替えられる (ついてきては対象外、強制移動の落とし方は同じ)", () => {
		expect(resolveMovement("gather", true, { gather: "auto" })).toBe("auto");
		expect(resolveMovement("gather", false, { gather: "auto" })).toBe("prompt");
		expect(resolveMovement("assemble", true, { gather: "auto" })).toBe("auto");
		expect(resolveMovement("call", true, { call: "prompt" })).toBe("prompt");
	});
});

describe("parseWhistleMessage", () => {
	it("壊れたメッセージは null", () => {
		expect(parseWhistleMessage({ kind: "whistle", id: "a" })).toBeNull();
		expect(parseWhistleMessage({ kind: "whistle", position: { x: 0, y: 0 } })).toBeNull();
		expect(
			parseWhistleMessage({ kind: "whistle-follow", id: "a", center: { x: 0, y: 0 } }),
		).toBeNull();
		expect(parseWhistleMessage({ kind: "spotlight-update", id: "a" })).toBeNull();
	});

	it("ズームが不正なら無視して位置だけ使う", () => {
		const msg = parseWhistleMessage({
			kind: "whistle",
			id: "a",
			whistleKind: "gather",
			position: { x: 1, y: 2 },
			zoom: -1,
		});
		expect(msg).toMatchObject({ whistleKind: "gather", position: { x: 1, y: 2 }, zoom: undefined });
	});
});

describe("edgePosition", () => {
	it("画面内はそのまま", () => {
		expect(edgePosition({ x: 100, y: 100 }, SIZE)).toMatchObject({
			x: 100,
			y: 100,
			onScreen: true,
		});
	});

	it("右の画面外は右端 (padding 内側) に寄せる", () => {
		const p = edgePosition({ x: 3000, y: 400 }, SIZE);
		expect(p).toMatchObject({ x: 960, y: 400, onScreen: false, angle: 0 });
	});
});

describe("planSwoop", () => {
	it("近いときは引かない", () => {
		const plan = planSwoop({ x: 0, y: 0, zoom: 1 }, { x: 600, y: 400 }, SIZE);
		expect(plan.outward).toBeNull();
	});

	it("すでに最小ズーム付近ならこれ以上引かない", () => {
		const plan = planSwoop({ x: 0, y: 0, zoom: 0.1 }, { x: 50000, y: 0 }, SIZE);
		expect(plan.outward).toBeNull();
	});

	it("遠いときは中点まで引いてから寄る", () => {
		const plan = planSwoop({ x: 0, y: 0, zoom: 1 }, { x: 5500, y: 400 }, SIZE, 1.5);
		expect(plan.outward?.zoom).toBeLessThan(1);
		expect(plan.target.zoom).toBe(1.5);
	});
});

describe("labels", () => {
	it("長い名前は省略し、空はだれか", () => {
		expect(displayName("", DEFAULT_WHISTLE_LABELS)).toBe("だれか");
		expect(displayName("a".repeat(30), DEFAULT_WHISTLE_LABELS)).toBe(`${"a".repeat(25)}…`);
	});

	it("kindNames は部分的に差し替えられる", () => {
		const labels = resolveLabels({ kindNames: { call: "Hey" } });
		expect(labels.kindNames.call).toBe("Hey");
		expect(labels.kindNames.gather).toBe("集合");
	});
});
