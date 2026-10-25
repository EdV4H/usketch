import type { TextMeasurer } from "./text-sizing.js";

/**
 * Measures unwrapped text with a hidden element styled like the text shape's
 * renderer (padding 4, line-height 1.4, border-box). Lives outside the canvas
 * so the camera zoom doesn't scale the result.
 */
export function createDomTextMeasurer(): { measure: TextMeasurer; dispose: () => void } {
	let el: HTMLDivElement | null = null;

	const measure: TextMeasurer = ({ text, fontSize, fontFamily }) => {
		if (typeof document === "undefined") return { width: 0, height: 0 };
		if (!el) {
			el = document.createElement("div");
			Object.assign(el.style, {
				position: "absolute",
				left: "-99999px",
				top: "0",
				visibility: "hidden",
				pointerEvents: "none",
				display: "inline-block",
				whiteSpace: "pre",
				lineHeight: "1.4",
				padding: "4px",
				boxSizing: "border-box",
			});
			el.setAttribute("aria-hidden", "true");
			document.body.appendChild(el);
		}
		el.style.fontSize = `${fontSize}px`;
		el.style.fontFamily = fontFamily;
		// An empty text or a trailing newline still occupies a line in the editor;
		// a zero-width space keeps that line measurable.
		el.textContent = text === "" || text.endsWith("\n") ? `${text}​` : text;
		const rect = el.getBoundingClientRect();
		return { width: rect.width, height: rect.height };
	};

	return {
		measure,
		dispose() {
			el?.remove();
			el = null;
		},
	};
}
