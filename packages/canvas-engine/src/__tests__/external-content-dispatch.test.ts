import type { ExternalContent, ExternalContentRegistry } from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import {
	dispatchDropToRegistry,
	dispatchPasteToRegistry,
	looksLikeUrl,
	parseUriList,
} from "../external-content-dispatch.js";

function spyRegistry(): { registry: ExternalContentRegistry; dispatched: ExternalContent[] } {
	const dispatched: ExternalContent[] = [];
	const registry: ExternalContentRegistry = {
		register: () => () => undefined,
		unregister: () => undefined,
		dispatch: async (c) => {
			dispatched.push(c as ExternalContent);
			return true;
		},
		getHandlers: () => [],
	};
	return { registry, dispatched };
}

function makeDataTransfer(opts: {
	files?: File[];
	uriList?: string;
	plainText?: string;
}): DataTransfer {
	const files = opts.files ?? [];
	const store: Record<string, string> = {};
	if (opts.uriList !== undefined) store["text/uri-list"] = opts.uriList;
	if (opts.plainText !== undefined) store["text/plain"] = opts.plainText;
	return {
		files: {
			length: files.length,
			item: (i: number) => files[i] ?? null,
			[Symbol.iterator]: function* () {
				for (const f of files) yield f;
			},
		} as unknown as FileList,
		getData: (type: string) => store[type] ?? "",
	} as unknown as DataTransfer;
}

describe("parseUriList", () => {
	it("splits on \\n and \\r\\n", () => {
		expect(parseUriList("https://a.test\nhttps://b.test")).toEqual([
			"https://a.test",
			"https://b.test",
		]);
		expect(parseUriList("https://a.test\r\nhttps://b.test")).toEqual([
			"https://a.test",
			"https://b.test",
		]);
	});

	it("skips comment lines (starting with #) and empty lines", () => {
		expect(parseUriList("# header\nhttps://a.test\n\n#trailer")).toEqual(["https://a.test"]);
	});

	it("trims whitespace", () => {
		expect(parseUriList("  https://a.test  \n\thttps://b.test")).toEqual([
			"https://a.test",
			"https://b.test",
		]);
	});

	it("returns empty array for empty input", () => {
		expect(parseUriList("")).toEqual([]);
	});
});

describe("looksLikeUrl", () => {
	it("recognizes http and https", () => {
		expect(looksLikeUrl("https://example.com")).toBe(true);
		expect(looksLikeUrl("http://example.com")).toBe(true);
	});

	it("recognizes data URLs", () => {
		expect(looksLikeUrl("data:image/png;base64,abc")).toBe(true);
	});

	it("rejects mailto / ftp / tel (out of scope for url kind)", () => {
		expect(looksLikeUrl("mailto:a@b.test")).toBe(false);
		expect(looksLikeUrl("ftp://example.com")).toBe(false);
		expect(looksLikeUrl("tel:+819012345678")).toBe(false);
	});

	it("rejects plain text", () => {
		expect(looksLikeUrl("hello world")).toBe(false);
		expect(looksLikeUrl("")).toBe(false);
	});

	it("rejects malformed http", () => {
		// new URL("http://") throws → false
		expect(looksLikeUrl("http://")).toBe(false);
	});
});

describe("dispatchDropToRegistry", () => {
	it("files take precedence over everything else", async () => {
		const { registry, dispatched } = spyRegistry();
		const f = new File(["x"], "x.png", { type: "image/png" });
		const dt = makeDataTransfer({
			files: [f],
			uriList: "https://example.com",
			plainText: "ignored",
		});
		const handled = await dispatchDropToRegistry(dt, registry);
		expect(handled).toBe(true);
		expect(dispatched).toHaveLength(1);
		expect(dispatched[0]).toMatchObject({ kind: "file", via: "drop" });
		expect((dispatched[0] as { files: readonly File[] }).files).toEqual([f]);
	});

	it("falls through to uri-list when no files", async () => {
		const { registry, dispatched } = spyRegistry();
		const dt = makeDataTransfer({ uriList: "https://a.test\nhttps://b.test" });
		await dispatchDropToRegistry(dt, registry);
		expect(dispatched).toHaveLength(2);
		expect(dispatched[0]).toMatchObject({
			kind: "url",
			via: "drop",
			url: "https://a.test",
			source: "uri-list",
		});
		expect(dispatched[1]).toMatchObject({ url: "https://b.test" });
	});

	it("falls through to text/plain → url when no files and no uri-list", async () => {
		const { registry, dispatched } = spyRegistry();
		const dt = makeDataTransfer({ plainText: "https://example.com" });
		await dispatchDropToRegistry(dt, registry);
		expect(dispatched).toHaveLength(1);
		expect(dispatched[0]).toMatchObject({
			kind: "url",
			via: "drop",
			source: "text",
		});
	});

	it("falls through to text/plain → text when plain text is not a URL", async () => {
		const { registry, dispatched } = spyRegistry();
		const dt = makeDataTransfer({ plainText: "hello world" });
		await dispatchDropToRegistry(dt, registry);
		expect(dispatched).toHaveLength(1);
		expect(dispatched[0]).toMatchObject({
			kind: "text",
			via: "drop",
			text: "hello world",
			html: null,
		});
	});

	it("returns false when DataTransfer is empty", async () => {
		const { registry, dispatched } = spyRegistry();
		const dt = makeDataTransfer({});
		const handled = await dispatchDropToRegistry(dt, registry);
		expect(handled).toBe(false);
		expect(dispatched).toHaveLength(0);
	});

	it("uri-list with only comments falls through to text/plain", async () => {
		const { registry, dispatched } = spyRegistry();
		const dt = makeDataTransfer({ uriList: "# just a comment", plainText: "fallback" });
		await dispatchDropToRegistry(dt, registry);
		expect(dispatched).toHaveLength(1);
		expect(dispatched[0]).toMatchObject({ kind: "text", text: "fallback" });
	});
});

describe("dispatchPasteToRegistry", () => {
	function makeClipboardEvent(opts: {
		target?: HTMLElement;
		files?: File[];
		items?: { kind: string; type: string; file: File | null }[];
		plainText?: string;
		html?: string;
	}): ClipboardEvent {
		const files = opts.files ?? [];
		const plainText = opts.plainText ?? "";
		const html = opts.html ?? "";
		const items =
			opts.items ?? files.map((f) => ({ kind: "file" as const, type: f.type, file: f }));
		const cd = {
			files: {
				length: files.length,
				item: (i: number) => files[i] ?? null,
				[Symbol.iterator]: function* () {
					for (const f of files) yield f;
				},
			} as unknown as FileList,
			items: items.map((it) => ({
				kind: it.kind,
				type: it.type,
				getAsFile: () => it.file,
			})) as unknown as DataTransferItemList,
			getData: (type: string) => {
				if (type === "text/plain") return plainText;
				if (type === "text/html") return html;
				return "";
			},
		} as unknown as DataTransfer;
		return {
			target: opts.target ?? globalThis.document?.body ?? null,
			clipboardData: cd,
			preventDefault: vi.fn(),
		} as unknown as ClipboardEvent;
	}

	it("returns false when target is null (no skip-target available)", async () => {
		const { registry, dispatched } = spyRegistry();
		const ev = {
			target: null,
			clipboardData: null,
			preventDefault: vi.fn(),
		} as unknown as ClipboardEvent;
		const handled = await dispatchPasteToRegistry(ev, registry);
		expect(handled).toBe(false);
		expect(dispatched).toHaveLength(0);
	});

	it("skips INPUT targets", async () => {
		const { registry, dispatched } = spyRegistry();
		const input = { tagName: "INPUT", isContentEditable: false } as unknown as HTMLElement;
		const ev = makeClipboardEvent({ target: input, plainText: "hello" });
		const handled = await dispatchPasteToRegistry(ev, registry);
		expect(handled).toBe(false);
		expect(dispatched).toHaveLength(0);
	});

	it("skips TEXTAREA targets", async () => {
		const { registry, dispatched } = spyRegistry();
		const ta = { tagName: "TEXTAREA", isContentEditable: false } as unknown as HTMLElement;
		const ev = makeClipboardEvent({ target: ta, plainText: "hello" });
		expect(await dispatchPasteToRegistry(ev, registry)).toBe(false);
		expect(dispatched).toHaveLength(0);
	});

	it("skips contentEditable targets", async () => {
		const { registry, dispatched } = spyRegistry();
		const ce = { tagName: "DIV", isContentEditable: true } as unknown as HTMLElement;
		const ev = makeClipboardEvent({ target: ce, plainText: "hello" });
		expect(await dispatchPasteToRegistry(ev, registry)).toBe(false);
		expect(dispatched).toHaveLength(0);
	});

	it("dispatches file kind from clipboard files", async () => {
		const { registry, dispatched } = spyRegistry();
		const f = new File(["x"], "x.png", { type: "image/png" });
		const ev = makeClipboardEvent({
			target: { tagName: "DIV", isContentEditable: false } as unknown as HTMLElement,
			files: [f],
		});
		await dispatchPasteToRegistry(ev, registry);
		expect(dispatched).toHaveLength(1);
		expect(dispatched[0]).toMatchObject({ kind: "file", via: "paste" });
	});

	it("falls back to items[].getAsFile for Safari-style paste", async () => {
		const { registry, dispatched } = spyRegistry();
		const f = new File(["x"], "x.png", { type: "image/png" });
		const ev = makeClipboardEvent({
			target: { tagName: "DIV", isContentEditable: false } as unknown as HTMLElement,
			files: [],
			items: [{ kind: "file", type: "image/png", file: f }],
		});
		await dispatchPasteToRegistry(ev, registry);
		expect(dispatched).toHaveLength(1);
		expect(dispatched[0]).toMatchObject({ kind: "file", via: "paste" });
	});

	it("dispatches url kind for URL-shaped text", async () => {
		const { registry, dispatched } = spyRegistry();
		const ev = makeClipboardEvent({
			target: { tagName: "DIV", isContentEditable: false } as unknown as HTMLElement,
			plainText: "https://example.com",
		});
		await dispatchPasteToRegistry(ev, registry);
		expect(dispatched).toHaveLength(1);
		expect(dispatched[0]).toMatchObject({
			kind: "url",
			via: "paste",
			url: "https://example.com",
		});
	});

	it("dispatches text kind for non-URL plain text plus html", async () => {
		const { registry, dispatched } = spyRegistry();
		const ev = makeClipboardEvent({
			target: { tagName: "DIV", isContentEditable: false } as unknown as HTMLElement,
			plainText: "hello",
			html: "<b>hello</b>",
		});
		await dispatchPasteToRegistry(ev, registry);
		expect(dispatched).toHaveLength(1);
		expect(dispatched[0]).toMatchObject({
			kind: "text",
			via: "paste",
			text: "hello",
			html: "<b>hello</b>",
		});
	});

	it("returns false when clipboard has nothing useful", async () => {
		const { registry, dispatched } = spyRegistry();
		const ev = makeClipboardEvent({
			target: { tagName: "DIV", isContentEditable: false } as unknown as HTMLElement,
		});
		expect(await dispatchPasteToRegistry(ev, registry)).toBe(false);
		expect(dispatched).toHaveLength(0);
	});
});
