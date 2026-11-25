import { describe, expect, it } from "vitest";
import { regionPageId, regionRedirectPath } from "../demo-board.js";

describe("regionRedirectPath", () => {
	it("地域はデモボードのそのページへ", () => {
		expect(regionRedirectPath("workshop")).toBe(`/?page=${regionPageId("workshop")}`);
		expect(regionRedirectPath("playground")).toBe("/?page=region-playground");
	});

	it("Lobby・空・おかしな slug はデモボードの先頭へ", () => {
		expect(regionRedirectPath("lobby")).toBe("/");
		expect(regionRedirectPath(undefined)).toBe("/");
		expect(regionRedirectPath("../x")).toBe("/");
	});
});
