import { describe, expect, it } from "vitest";
import {
	countdownRemainingMs,
	createGatherConfig,
	GATHER_COUNTDOWN_MS,
	GATHER_MAX_AUDIENCE,
	GATHER_MAX_MS,
	gatherRemainingMs,
	initialParticipation,
	isGatherAudience,
	isGatherLive,
	isViewOnlyForMe,
	parseGather,
	parseGatherAudience,
	parseGatherBackdrop,
} from "../gather.js";

const rect = { x: 10, y: 20, width: 300, height: 200 };
const make = () =>
	createGatherConfig(
		{
			hold: "stay",
			target: { rect, shapeId: "f" },
			hostName: "host",
			title: " KPT ",
			prompt: " How do you feel? ",
			backdrop: { color: "#003735", imageUrl: "https://example.com/bg.png" },
			durationMinutes: 10,
			viewOnly: true,
		},
		1000,
	);

describe("createGatherConfig / parseGather", () => {
	it("sets the limit and the safety net, trims the title", () => {
		const c = make();
		expect(c.endsAt).toBe(1000 + 10 * 60_000);
		expect(c.expiresAt).toBe(1000 + GATHER_MAX_MS);
		expect(c.title).toBe("KPT");
		expect(c.prompt).toBe("How do you feel?");
		expect(
			createGatherConfig({ hold: "stay", target: { rect }, prompt: "  " }, 0),
		).not.toHaveProperty("prompt");
	});

	it("round-trips and rejects broken values", () => {
		const { type: _t, ...rest } = make();
		expect(parseGather(make())).toEqual({ type: "gather", ...rest });
		expect(parseGather(null)).toBeNull();
		expect(parseGather({ ...make(), target: { rect: { ...rect, width: 0 } } })).toBeNull();
		expect(parseGather({ ...make(), startedAt: "1" })).toBeNull();
		expect(parseGather({ ...make(), hold: "lock" })?.hold).toBe("stay");
	});

	it("keeps viewOnly only when it is true", () => {
		expect(make().viewOnly).toBe(true);
		expect(createGatherConfig({ hold: "stay", target: { rect } }, 0)).not.toHaveProperty(
			"viewOnly",
		);
		expect(parseGather({ ...make(), viewOnly: "yes" })).not.toHaveProperty("viewOnly");
		expect(parseGather({ ...make(), viewOnly: false })).not.toHaveProperty("viewOnly");
	});
});

describe("audience", () => {
	it("keeps distinct, non-empty ids and drops the rest; no list means everyone", () => {
		expect(parseGatherAudience([" a ", "b", "a", "", 3, null])).toEqual(["a", "b"]);
		expect(parseGatherAudience("a")).toBeUndefined();
		expect(parseGatherAudience([])).toEqual([]);
		const many = Array.from({ length: GATHER_MAX_AUDIENCE + 10 }, (_, i) => `u${i}`);
		expect(parseGatherAudience(many)).toHaveLength(GATHER_MAX_AUDIENCE);
	});

	it("is kept through createGatherConfig / parseGather only when given", () => {
		const c = createGatherConfig({ hold: "stay", target: { rect }, audience: ["a", "a"] }, 0);
		expect(c.audience).toEqual(["a"]);
		expect(parseGather(c)?.audience).toEqual(["a"]);
		expect(make()).not.toHaveProperty("audience");
		expect(parseGather({ ...make(), audience: "a" })).not.toHaveProperty("audience");
	});

	it("includes the host and listed people; without a list, everyone", () => {
		expect(isGatherAudience({ audience: ["a"] }, "a", false)).toBe(true);
		expect(isGatherAudience({ audience: ["a"] }, "b", false)).toBe(false);
		expect(isGatherAudience({ audience: [] }, "host", true)).toBe(true);
		expect(isGatherAudience({}, "b", false)).toBe(true);
	});
});

describe("isViewOnlyForMe", () => {
	const gather = parseGather(make());
	it("limits participants who are taking part or about to", () => {
		expect(isViewOnlyForMe({ gather, isHost: false, participation: "joined" })).toBe(true);
		expect(isViewOnlyForMe({ gather, isHost: false, participation: "countdown" })).toBe(true);
	});
	it("leaves the host, invited and away people free", () => {
		expect(isViewOnlyForMe({ gather, isHost: true, participation: "joined" })).toBe(false);
		expect(isViewOnlyForMe({ gather, isHost: false, participation: "invited" })).toBe(false);
		expect(isViewOnlyForMe({ gather, isHost: false, participation: "away" })).toBe(false);
		expect(isViewOnlyForMe({ gather: null, isHost: false, participation: null })).toBe(false);
	});
	it("does nothing when the gathering does not ask for it", () => {
		const free = parseGather({ ...make(), viewOnly: undefined });
		expect(isViewOnlyForMe({ gather: free, isHost: false, participation: "joined" })).toBe(false);
	});
});

describe("parseGatherBackdrop", () => {
	it("keeps a hex color and an http(s) image URL, drops the rest", () => {
		expect(parseGatherBackdrop({ color: " #0a0 ", imageUrl: "https://x.test/a b.png" })).toEqual({
			color: "#0a0",
			imageUrl: "https://x.test/a%20b.png",
		});
		expect(parseGatherBackdrop({ color: "red", imageUrl: "javascript:alert(1)" })).toBeUndefined();
		expect(
			parseGatherBackdrop({ color: "#12345", imageUrl: "data:image/png;base64,AA" }),
		).toBeUndefined();
		expect(parseGatherBackdrop({ imageUrl: "http://x.test/a.png" })).toEqual({
			imageUrl: "http://x.test/a.png",
		});
		expect(parseGatherBackdrop("#fff")).toBeUndefined();
		// 前後の空白は落としてから測り、正規化で上限を超えたものは落とす
		const near = `https://x.test/${"a".repeat(2000)}`;
		expect(parseGatherBackdrop({ imageUrl: `  ${near}  ` })).toEqual({ imageUrl: near });
		expect(
			parseGatherBackdrop({ imageUrl: `https://x.test/${" ".repeat(1100)}a` }),
		).toBeUndefined();
	});

	it("is left out of the config when nothing is valid", () => {
		expect(
			createGatherConfig({ hold: "stay", target: { rect }, backdrop: { color: "blue" } }, 0),
		).not.toHaveProperty("backdrop");
		expect(parseGather({ ...make(), backdrop: { imageUrl: "ftp://x" } })).not.toHaveProperty(
			"backdrop",
		);
	});
});

describe("time", () => {
	it("ends at the limit, or at the safety net without one", () => {
		const g = parseGather(make());
		if (!g?.endsAt) throw new Error("no limit");
		expect(isGatherLive(g, g.endsAt - 1)).toBe(true);
		expect(isGatherLive(g, g.endsAt)).toBe(false);
		expect(gatherRemainingMs(g, g.endsAt - 1500)).toBe(1500);
		const open = parseGather({ ...make(), endsAt: undefined });
		if (!open) throw new Error("parse");
		expect(gatherRemainingMs(open, 0)).toBeNull();
		expect(isGatherLive(open, open.expiresAt)).toBe(false);
	});

	it("never counts down longer than 3 s on a skewed clock", () => {
		const g = parseGather(make());
		if (!g) throw new Error("parse");
		expect(countdownRemainingMs(g, -60_000)).toBe(GATHER_COUNTDOWN_MS);
		expect(countdownRemainingMs(g, 3000)).toBe(1000);
		expect(countdownRemainingMs(g, 9000)).toBe(0);
	});
});

describe("initialParticipation", () => {
	const g = parseGather(make());
	if (!g) throw new Error("parse");
	const base = { isHost: false, canAutoMove: true, seenOnLoad: false, startAway: false, gather: g };
	it("host joins, others count down or join", () => {
		expect(initialParticipation({ ...base, isHost: true, canAutoMove: false, now: 0 })).toBe(
			"joined",
		);
		expect(initialParticipation({ ...base, now: 1500 })).toBe("countdown");
		expect(initialParticipation({ ...base, now: 1000 + GATHER_COUNTDOWN_MS })).toBe("joined");
	});
	it("with confirm, everyone but the host is asked first", () => {
		const c = { ...base, confirm: true };
		expect(initialParticipation({ ...c, isHost: true, now: 1500 })).toBe("joined");
		expect(initialParticipation({ ...c, now: 1500 })).toBe("invited");
		expect(initialParticipation({ ...c, seenOnLoad: true, now: 99_000 })).toBe("invited");
		expect(initialParticipation({ ...c, seenOnLoad: true, startAway: true, now: 1100 })).toBe(
			"away",
		);
		expect(initialParticipation({ ...c, canAutoMove: false, now: 1500 })).toBe("away");
	});
	it("late joiners join at once, deep links and blocked cameras start away", () => {
		expect(initialParticipation({ ...base, seenOnLoad: true, now: 1100 })).toBe("joined");
		expect(initialParticipation({ ...base, seenOnLoad: true, startAway: true, now: 1100 })).toBe(
			"away",
		);
		expect(initialParticipation({ ...base, canAutoMove: false, now: 1100 })).toBe("away");
	});
});
