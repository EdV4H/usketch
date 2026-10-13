import type { OpenSlideDesign } from "./types.js";

/** open-slide の `designToCssVars` と同じ CSS 変数 (`--osd-*`) を作る。 */
export function openSlideDesignToCssVars(d: OpenSlideDesign): Record<string, string> {
	return {
		"--osd-bg": d.palette.bg,
		"--osd-text": d.palette.text,
		"--osd-accent": d.palette.accent,
		"--osd-font-display": d.fonts.display,
		"--osd-font-body": d.fonts.body,
		"--osd-size-hero": `${d.typeScale.hero}px`,
		"--osd-size-body": `${d.typeScale.body}px`,
		"--osd-radius": `${d.radius}px`,
	};
}
