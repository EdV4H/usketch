// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { isSvgFile, isSvgUrl, sanitizeSvg, svgIntrinsicSize, svgToDataUri } from "../svg-utils.js";

describe("isSvgFile", () => {
	it("matches by MIME type", () => {
		expect(isSvgFile({ type: "image/svg+xml", name: "a.png" })).toBe(true);
	});
	it("matches by .svg extension (case-insensitive)", () => {
		expect(isSvgFile({ type: "", name: "logo.SVG" })).toBe(true);
	});
	it("rejects non-svg", () => {
		expect(isSvgFile({ type: "image/png", name: "a.png" })).toBe(false);
	});
});

describe("isSvgUrl", () => {
	it("matches .svg ignoring query/hash", () => {
		expect(isSvgUrl("https://example.com/a/logo.svg?v=2#x")).toBe(true);
	});
	it("rejects non-svg urls", () => {
		expect(isSvgUrl("https://example.com/a.png")).toBe(false);
		expect(isSvgUrl("https://example.com/page")).toBe(false);
	});
});

describe("sanitizeSvg", () => {
	it("strips <script> elements", () => {
		const out = sanitizeSvg(
			`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect/></svg>`,
		);
		expect(out).not.toBeNull();
		expect(out).not.toContain("script");
		expect(out).toContain("rect");
	});

	it("strips <foreignObject>", () => {
		const out = sanitizeSvg(
			`<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body/></foreignObject></svg>`,
		);
		expect(out).not.toBeNull();
		expect(out?.toLowerCase()).not.toContain("foreignobject");
	});

	it("removes on* event handler attributes", () => {
		const out = sanitizeSvg(
			`<svg xmlns="http://www.w3.org/2000/svg"><rect onload="alert(1)" onclick="x()"/></svg>`,
		);
		expect(out).not.toBeNull();
		expect(out?.toLowerCase()).not.toContain("onload");
		expect(out?.toLowerCase()).not.toContain("onclick");
	});

	it("removes javascript: hrefs", () => {
		const out = sanitizeSvg(
			`<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect/></a></svg>`,
		);
		expect(out).not.toBeNull();
		expect(out?.toLowerCase()).not.toContain("javascript:");
	});

	it("keeps benign markup", () => {
		const out = sanitizeSvg(
			`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect x="0" y="0" width="10" height="10"/></svg>`,
		);
		expect(out).toContain("rect");
	});

	it("returns null for non-svg / unparsable markup", () => {
		expect(sanitizeSvg("<html><body>not svg</body></html>")).toBeNull();
	});
});

describe("svgIntrinsicSize", () => {
	it("reads width/height", () => {
		expect(
			svgIntrinsicSize(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"></svg>`),
		).toEqual({ width: 320, height: 240 });
	});
	it("falls back to viewBox", () => {
		expect(
			svgIntrinsicSize(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48"></svg>`),
		).toEqual({ width: 64, height: 48 });
	});
	it("uses the fallback square when size is absent", () => {
		expect(svgIntrinsicSize(`<svg xmlns="http://www.w3.org/2000/svg"></svg>`, 200)).toEqual({
			width: 200,
			height: 200,
		});
	});
});

describe("svgToDataUri", () => {
	it("produces a url-encoded svg data uri", () => {
		const uri = svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg"></svg>`);
		expect(uri.startsWith("data:image/svg+xml,")).toBe(true);
		expect(uri).toContain("%3Csvg");
	});
});
