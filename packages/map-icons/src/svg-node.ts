// The data model for a bundled, static SVG element tree (an icon's markup). A
// plain description — NOT React — so this package stays dependency-free. The map
// plugin renders these via its own `renderSvgNodes` (React.createElement), and its
// structurally-identical `SvgNode` interoperates with this one.
export interface SvgNode {
	/** Tag name (rect, g, path, circle, ellipse, line, polyline, polygon, …). */
	t: string;
	/** Presentational attributes, as authored (hyphenated names allowed). */
	a: Record<string, string>;
	/** Child nodes. */
	c?: SvgNode[];
}
