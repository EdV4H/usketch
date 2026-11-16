import { describe, expect, it } from "vitest";
import {
	countdownRemainingMs,
	createGatherConfig,
	GATHER_COUNTDOWN_MS,
	GATHER_MAX_MS,
	gatherRemainingMs,
	initialParticipation,
	isGatherLive,
	parseGather,
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
