/**
 * SVG helpers for importing SVG "as-is" (vector) into an image shape.
 *
 * Security: the image shape renders via `<img src>`, and SVG loaded through
 * `<img>` runs in a non-scripted, no-external-fetch context per the HTML spec —
 * so embedded `<script>` never executes. On top of that browser guarantee we
 * still sanitize on import (defense-in-depth, and in case the markup is ever
 * rendered inline): strip `<script>`/`<foreignObject>`, `on*` handlers, and
 * `javascript:` hrefs. Remote `.svg` URLs can't be sanitized (not fetched); they
 * rely on the same `<img>` non-scripting guarantee.
 */

/** Whether a dropped file is an SVG (by MIME or `.svg` extension). */
export function isSvgFile(file: { type: string; name: string }): boolean {
	return file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
}

/** Whether a URL points at an `.svg` (ignoring query/hash). */
export function isSvgUrl(url: string): boolean {
	try {
		const u = new URL(url);
		return /\.svg$/i.test(u.pathname);
	} catch {
		return /\.svg(?:[?#]|$)/i.test(url);
	}
}

/**
 * Sanitize SVG markup: drop `<script>`/`<foreignObject>`, `on*` event-handler
 * attributes, and `javascript:` (x)href values. Returns `null` if the markup
 * can't be parsed as SVG or no DOM is available (caller should refuse to embed).
 */
export function sanitizeSvg(markup: string): string | null {
	if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") return null;
	const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
	if (doc.getElementsByTagName("parsererror").length > 0) return null;
	const svg = doc.documentElement;
	if (!svg || svg.nodeName.toLowerCase() !== "svg") return null;
	sanitizeElement(svg);
	return new XMLSerializer().serializeToString(svg);
}

function sanitizeElement(el: Element): void {
	// Snapshot children first — we remove some during the walk.
	for (const child of Array.from(el.children)) {
		const tag = child.nodeName.toLowerCase();
		if (tag === "script" || tag === "foreignobject") {
			child.remove();
			continue;
		}
		sanitizeElement(child);
	}
	for (const attr of Array.from(el.attributes)) {
		const name = attr.name.toLowerCase();
		if (name.startsWith("on")) {
			el.removeAttribute(attr.name);
			continue;
		}
		if (
			(name === "href" || name === "xlink:href" || name === "src") &&
			/^\s*javascript:/i.test(attr.value)
		) {
			el.removeAttribute(attr.name);
		}
	}
}

/**
 * Intrinsic size from `width`/`height` (px) or `viewBox`, falling back to a
 * square default. Fixes the fragile `naturalWidth === 0` path for size-less SVGs.
 */
export function svgIntrinsicSize(
	markup: string,
	fallback = 200,
): { width: number; height: number } {
	if (typeof DOMParser !== "undefined") {
		try {
			const svg = new DOMParser().parseFromString(markup, "image/svg+xml").documentElement;
			const w = Number.parseFloat(svg.getAttribute("width") ?? "");
			const h = Number.parseFloat(svg.getAttribute("height") ?? "");
			if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
				return { width: w, height: h };
			}
			const vb = svg.getAttribute("viewBox");
			if (vb) {
				const p = vb.split(/[\s,]+/).map(Number);
				if (p.length === 4 && p[2] > 0 && p[3] > 0) return { width: p[2], height: p[3] };
			}
		} catch {
			// fall through to default
		}
	}
	return { width: fallback, height: fallback };
}

/** A `<img>`-safe data URI for sanitized SVG markup (kept as vector, not rasterized). */
export function svgToDataUri(markup: string): string {
	return `data:image/svg+xml,${encodeURIComponent(markup)}`;
}

/** Read a File as UTF-8 text. */
export function readFileAsText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(new Error("Failed to read file"));
		reader.readAsText(file);
	});
}
