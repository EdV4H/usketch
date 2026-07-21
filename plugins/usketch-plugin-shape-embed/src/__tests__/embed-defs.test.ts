import { describe, expect, it } from "vitest";
import { GENERIC_DEF, resolveEmbed, YOUTUBE_DEF } from "../embed-defs.js";

describe("resolveEmbed — YouTube", () => {
	it("converts watch / youtu.be / shorts / embed URLs to a nocookie embed", () => {
		for (const url of [
			"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			"https://youtu.be/dQw4w9WgXcQ",
			"https://www.youtube.com/shorts/dQw4w9WgXcQ",
			"https://www.youtube.com/embed/dQw4w9WgXcQ",
		]) {
			const r = resolveEmbed(url);
			expect(r?.def.id).toBe("youtube");
			expect(r?.embedUrl).toContain("/embed/dQw4w9WgXcQ");
			expect(r?.embedUrl).toContain("enablejsapi=1"); // required for sync
		}
	});

	it("YouTube is marked syncable and keeps allow-same-origin", () => {
		expect(YOUTUBE_DEF.syncable).toBe(true);
		expect(YOUTUBE_DEF.sandbox).toContain("allow-same-origin");
	});
});

describe("resolveEmbed — providers", () => {
	it("matches figma / vimeo / google maps by hostname", () => {
		expect(resolveEmbed("https://www.figma.com/design/abc/My")?.def.id).toBe("figma");
		expect(resolveEmbed("https://vimeo.com/123456789")?.def.id).toBe("vimeo");
		expect(resolveEmbed("https://maps.google.com/maps?q=tokyo")?.def.id).toBe("google-maps");
	});
});

describe("resolveEmbed — generic fallback & guards", () => {
	it("falls back to GENERIC with a strict sandbox (no allow-same-origin)", () => {
		const r = resolveEmbed("https://example.com/some/page");
		expect(r?.def.id).toBe("generic");
		expect(r?.embedUrl).toBe("https://example.com/some/page");
		expect(GENERIC_DEF.sandbox).not.toContain("allow-same-origin");
	});

	it("rejects non-http(s) and unparseable input", () => {
		expect(resolveEmbed("javascript:alert(1)")).toBeNull();
		expect(resolveEmbed("data:text/html,<h1>x</h1>")).toBeNull();
		expect(resolveEmbed("not a url")).toBeNull();
		expect(resolveEmbed("")).toBeNull();
	});

	it("custom defs (passed first) override defaults", () => {
		const custom = {
			id: "my-yt",
			title: "Custom",
			hostnames: ["youtube.com"],
			toEmbedUrl: () => "https://custom/embed",
			sandbox: "allow-scripts",
		};
		const r = resolveEmbed("https://www.youtube.com/watch?v=x", [custom, YOUTUBE_DEF]);
		expect(r?.def.id).toBe("my-yt");
	});
});
