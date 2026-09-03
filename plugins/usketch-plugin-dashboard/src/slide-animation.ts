// A CSS-only slide animation for dashboard reflow: shapes are positioned by the DOM
// renderer with `left`/`top` (each tagged `data-shape-id`), so a transition on those
// properties makes every programmatic move (reflow, avoid, repack, drop-snap) glide
// instead of jump. The one shape being actively dragged is EXCLUDED so it tracks the
// pointer with no lag. The rule lives in one <style> element toggled on/off with the
// dashboard, so non-dashboard boards are unaffected.
const STYLE_ID = "usketch-dashboard-slide";
const DURATION_MS = 180;
const EASING = "cubic-bezier(.2,.8,.2,1)";

let active = false;
let excludeId: string | null = null;

/** Escape a shape id for use inside a CSS attribute selector. */
function cssEscape(v: string): string {
	const anyCss = (globalThis as { CSS?: { escape?: (s: string) => string } }).CSS;
	if (anyCss?.escape) return anyCss.escape(v);
	return v.replace(/["\\]/g, "\\$&");
}

function styleEl(): HTMLStyleElement | null {
	if (typeof document === "undefined") return null;
	let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
	if (!el) {
		el = document.createElement("style");
		el.id = STYLE_ID;
		document.head.appendChild(el);
	}
	return el;
}

function render(): void {
	const el = styleEl();
	if (!el) return;
	if (!active) {
		el.textContent = "";
		return;
	}
	const not = excludeId ? `:not([data-shape-id="${cssEscape(excludeId)}"])` : "";
	el.textContent = `[data-shape-id]${not}{transition:left ${DURATION_MS}ms ${EASING},top ${DURATION_MS}ms ${EASING}}`;
}

/** Turn the slide transition on/off (follows whether the board is a dashboard). */
export function setSlideActive(on: boolean): void {
	if (active === on) return;
	active = on;
	render();
}

/** Exclude the actively-dragged shape from the transition (null re-includes all). */
export function setSlideExclude(id: string | null): void {
	if (excludeId === id) return;
	excludeId = id;
	render();
}

/** Remove the stylesheet and reset state (plugin teardown). */
export function teardownSlide(): void {
	active = false;
	excludeId = null;
	styleEl()?.remove();
}
