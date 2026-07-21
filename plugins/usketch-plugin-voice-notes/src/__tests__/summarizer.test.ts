import { describe, expect, it } from "vitest";
import { parseSummary } from "../summarizer.js";

describe("parseSummary", () => {
	it("parses a clean JSON object", () => {
		const s = parseSummary(
			'{"title":"設計会議","points":[{"label":"目標"},{"label":"制約","detail":"予算"}],"links":[[0,1]]}',
		);
		expect(s?.title).toBe("設計会議");
		expect(s?.points).toHaveLength(2);
		expect(s?.points[1]).toEqual({ label: "制約", detail: "予算" });
		expect(s?.links).toEqual([[1 - 1, 1]]); // [0,1]
	});

	it("tolerates code fences and surrounding prose", () => {
		const raw =
			'ここが要約です:\n```json\n{"title":"X","points":[{"label":"A"}],"links":[]}\n```\n以上';
		const s = parseSummary(raw);
		expect(s?.title).toBe("X");
		expect(s?.points).toEqual([{ label: "A" }]);
	});

	it("drops out-of-range and self links (dedup is the layout's job)", () => {
		const s = parseSummary(
			'{"title":"T","points":[{"label":"a"},{"label":"b"}],"links":[[0,1],[0,1],[0,0],[0,5]]}',
		);
		// [0,0] self-link and [0,5] out-of-range removed; both valid [0,1] kept.
		expect(s?.links).toEqual([
			[0, 1],
			[0, 1],
		]);
	});

	it("defaults the title and requires at least one point", () => {
		expect(parseSummary('{"points":[{"label":"only"}],"links":[]}')?.title).toBe("まとめ");
		expect(parseSummary('{"title":"empty","points":[],"links":[]}')).toBeNull();
	});

	it("returns null for non-JSON / broken input", () => {
		expect(parseSummary("")).toBeNull();
		expect(parseSummary("no json here")).toBeNull();
		expect(parseSummary("{ not valid json ")).toBeNull();
	});
});
