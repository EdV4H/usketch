import type { ExternalContentRegistry } from "@edv4h/usketch-shared";

/**
 * Parse a RFC 2483 `text/uri-list` payload into URLs.
 * - Lines are `\r\n` or `\n` separated.
 * - Lines starting with `#` are comments and skipped.
 * - Empty lines are skipped.
 */
export function parseUriList(input: string): string[] {
	return input
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith("#"));
}

/**
 * Conservatively determine whether a string looks like an HTTP(S) or data URL.
 *
 * Intentionally narrower than `URL` parsing — `mailto:`, `ftp:`, `tel:` etc.
 * happen to be valid URLs but are out of scope for the external-content
 * `kind: "url"` channel. Such payloads should arrive as `kind: "text"` so
 * a downstream handler can decide what to do with them.
 */
export function looksLikeUrl(input: string): boolean {
	const trimmed = input.trim();
	if (!/^https?:\/\//i.test(trimmed) && !/^data:/i.test(trimmed)) return false;
	try {
		new URL(trimmed);
		return true;
	} catch {
		return false;
	}
}

/**
 * Inspect a `DataTransfer` from a drop event and dispatch to the
 * external-content registry. Priority (mirrors what tldraw / Figma / Miro do):
 *   1. files (always wins if present — file drag-and-drop is unambiguous).
 *   2. text/uri-list (URL drag from browser address bar / bookmarks).
 *   3. text/plain (URL-shaped → `kind: "url"`, otherwise `kind: "text"`).
 *
 * Returns whether any dispatch occurred (i.e. at least one piece of content
 * was sent to the registry).
 */
export async function dispatchDropToRegistry(
	dt: DataTransfer,
	registry: ExternalContentRegistry,
): Promise<boolean> {
	// 1. files
	if (dt.files.length > 0) {
		await registry.dispatch({
			kind: "file",
			via: "drop",
			files: Array.from(dt.files),
		});
		return true;
	}

	// 2. text/uri-list
	const uriList = dt.getData("text/uri-list");
	if (uriList) {
		const urls = parseUriList(uriList);
		if (urls.length > 0) {
			for (const url of urls) {
				await registry.dispatch({
					kind: "url",
					via: "drop",
					url,
					source: "uri-list",
				});
			}
			return true;
		}
	}

	// 3. text/plain
	const text = dt.getData("text/plain");
	if (text) {
		if (looksLikeUrl(text)) {
			await registry.dispatch({
				kind: "url",
				via: "drop",
				url: text,
				source: "text",
			});
		} else {
			await registry.dispatch({
				kind: "text",
				via: "drop",
				text,
				html: null,
			});
		}
		return true;
	}

	return false;
}

/**
 * Inspect a `ClipboardEvent` and dispatch to the external-content registry.
 *
 * Skip rules: when the paste target is an `<input>`, `<textarea>`, or
 * `contentEditable` element, this returns `false` without touching the
 * registry and without calling `preventDefault` — the browser handles those.
 *
 * Returns whether `preventDefault` should be called by the caller (i.e.
 * a dispatch was attempted). The actual `preventDefault` call is left to
 * the caller so it can keep React event semantics consistent.
 */
export async function dispatchPasteToRegistry(
	event: ClipboardEvent,
	registry: ExternalContentRegistry,
): Promise<boolean> {
	const target = event.target as HTMLElement | null;
	if (!target) return false;
	if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return false;
	if (target.isContentEditable) return false;

	const cd = event.clipboardData;
	if (!cd) return false;

	// 1. files (modern browsers)
	let files: File[] | null = cd.files.length > 0 ? Array.from(cd.files) : null;

	// 2. Safari paste-from-screenshot lands in items rather than files.
	if (!files && cd.items) {
		const collected: File[] = [];
		for (const item of Array.from(cd.items)) {
			if (item.kind === "file") {
				const f = item.getAsFile();
				if (f) collected.push(f);
			}
		}
		if (collected.length > 0) files = collected;
	}

	if (files) {
		await registry.dispatch({
			kind: "file",
			via: "paste",
			files,
		});
		return true;
	}

	const text = cd.getData("text/plain");
	const html = cd.getData("text/html");

	if (text && looksLikeUrl(text)) {
		await registry.dispatch({
			kind: "url",
			via: "paste",
			url: text,
			source: "text",
		});
		return true;
	}

	if (text || html) {
		await registry.dispatch({
			kind: "text",
			via: "paste",
			text: text ?? "",
			html: html || null,
		});
		return true;
	}

	return false;
}
