import type { ExternalContent, ExternalContentRegistry } from "@edv4h/usketch-shared";

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
 * Synchronously inspect a `ClipboardEvent` and return an `ExternalContent`
 * payload ready to be dispatched, or `null` when the paste should be left
 * to the browser.
 *
 * This is split out from `dispatchPasteToRegistry` so the caller can call
 * `event.preventDefault()` synchronously — by the time an `async` function
 * suspends at `await`, browsers may have already performed the default paste
 * (inserting text into the focused element, navigating, etc.).
 *
 * Skip rules: returns `null` when the paste target is an `<input>`,
 * `<textarea>`, or `contentEditable` element so browser-native paste in form
 * fields keeps working.
 */
export function extractPasteContent(event: ClipboardEvent): ExternalContent | null {
	const target = event.target as HTMLElement | null;
	if (!target) return null;
	if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return null;
	if (target.isContentEditable) return null;

	const cd = event.clipboardData;
	if (!cd) return null;

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
		return { kind: "file", via: "paste", files };
	}

	const text = cd.getData("text/plain");
	const html = cd.getData("text/html");

	if (text && looksLikeUrl(text)) {
		return { kind: "url", via: "paste", url: text, source: "text" };
	}

	if (text || html) {
		return {
			kind: "text",
			via: "paste",
			text: text ?? "",
			html: html || null,
		};
	}

	return null;
}

/**
 * Inspect a `ClipboardEvent` and dispatch to the external-content registry.
 *
 * Prefer {@link extractPasteContent} + a synchronous `event.preventDefault()`
 * in the caller. This async helper is kept for callers that don't need to
 * preempt default paste behavior.
 *
 * Returns whether a dispatch was attempted.
 */
export async function dispatchPasteToRegistry(
	event: ClipboardEvent,
	registry: ExternalContentRegistry,
): Promise<boolean> {
	const content = extractPasteContent(event);
	if (!content) return false;
	await registry.dispatch(content);
	return true;
}
