// GENERATED from design (RPGマップ素材.dc.html). Terrain/icon color CSS variables.
// color = カラフル, mono = モノクロ（Tweaks）。stroke/card は固定。
export type ColorMode = "color" | "mono";

const COLOR_VARS: Record<string, string> = {
	"--red": "#EF5350",
	"--blue": "#4A7FB8",
	"--purple": "#6C5CD6",
	"--teal": "#2AA1A8",
	"--yellow": "#F6C124",
	"--green": "#25A05B",
	"--pink": "#F48CB4",
	"--orange": "#F0913E",
	"--brown": "#9A6A3C",
	"--t-grass": "#A9D888",
	"--t-forest": "#71B96C",
	"--t-water": "#8CC3E6",
	"--t-sand": "#F0DBA3",
	"--t-mtn": "#C7B6A0",
	"--t-path": "#E7CF9E",
	"--t-grass-d": "#82C15E",
	"--t-forest-d": "#4E9E58",
	"--t-water-d": "#5EA8D6",
	"--t-sand-d": "#E3C071",
	"--t-mtn-d": "#A8927A",
	"--t-path-d": "#CBB07A",
	"--t-snow": "#E9F2F8",
	"--t-swamp": "#9BAE74",
	"--t-lava": "#EE9264",
	"--t-stone": "#CDCAC3",
	"--t-farm": "#DDBB7E",
	"--t-flower": "#C4E3A5",
	"--t-snow-d": "#BCD3E3",
	"--t-swamp-d": "#6F8850",
	"--t-lava-d": "#CE5638",
	"--t-stone-d": "#ABA79E",
	"--t-farm-d": "#B99350",
	"--t-flower-d": "#95CA79",
};

const MONO_VARS: Record<string, string> = {
	"--red": "#E7E8EB",
	"--blue": "#E7E8EB",
	"--purple": "#E7E8EB",
	"--teal": "#E7E8EB",
	"--yellow": "#EEEFF2",
	"--green": "#E7E8EB",
	"--pink": "#EEEFF2",
	"--orange": "#EEEFF2",
	"--brown": "#DCDCDF",
	"--t-grass": "#EDEEF0",
	"--t-forest": "#DDDFE3",
	"--t-water": "#EAEFF3",
	"--t-sand": "#F1F1F0",
	"--t-mtn": "#DDDDE0",
	"--t-path": "#EDE9E2",
	"--t-grass-d": "#CFD1D6",
	"--t-forest-d": "#CFD1D6",
	"--t-water-d": "#D6DBE0",
	"--t-sand-d": "#DEDDDA",
	"--t-mtn-d": "#BFBFC5",
	"--t-path-d": "#D9D4CC",
	"--t-snow": "#F4F5F7",
	"--t-swamp": "#DFE0DC",
	"--t-lava": "#E9E9EB",
	"--t-stone": "#E2E2E4",
	"--t-farm": "#EDEAE3",
	"--t-flower": "#EAEEE9",
	"--t-snow-d": "#D8DADF",
	"--t-swamp-d": "#C8CAC5",
	"--t-lava-d": "#CFCFD3",
	"--t-stone-d": "#C8C8CB",
	"--t-farm-d": "#D7D2C9",
	"--t-flower-d": "#CFD5CE",
};

/** Fixed (mode-independent) design tokens shared by terrain + icons. */
const BASE_VARS: Record<string, string> = {
	"--uskmap-stroke": "#141414",
	"--uskmap-card": "#FFFFFF",
};

/**
 * CSS custom properties to place on a container so the raw SVG markup (which
 * references `var(--t-grass)`, `var(--red)`, `var(--stroke)`, ...) resolves.
 * `strokeScale` scales the hand-drawn stroke width (design `--sw`, base 2.6px).
 */
export function terrainCssVars(mode: ColorMode, strokeScale = 1): Record<string, string> {
	const src = mode === "mono" ? MONO_VARS : COLOR_VARS;
	const out: Record<string, string> = { ...BASE_VARS };
	for (const [k, v] of Object.entries(src)) out[k] = v;
	// design markup uses bare --stroke/--card; alias them.
	out["--stroke"] = BASE_VARS["--uskmap-stroke"];
	out["--card"] = BASE_VARS["--uskmap-card"];
	out["--sw"] = `${2.6 * strokeScale}px`;
	return out;
}
