// Renders a parsed SVG element tree (from terrain.ts / icons.ts) with
// React.createElement — deliberately NOT dangerouslySetInnerHTML, matching the
// repo's XSS-safe policy. The data is static bundled design markup; this keeps
// it as real React SVG elements with proper (camelCased) attributes.
import { createElement, type ReactElement } from "react";

export interface SvgNode {
	/** Tag name (rect, g, path, circle, ellipse, line, polyline, polygon, …). */
	t: string;
	/** Presentational attributes, as authored (hyphenated names are converted). */
	a: Record<string, string>;
	/** Child nodes. */
	c?: SvgNode[];
}

// Attribute names that must NOT be naively hyphen→camel converted the generic way.
const ATTR_MAP: Record<string, string> = {
	class: "className",
	"xlink:href": "xlinkHref",
};

/** Convert an SVG attribute name to its React (camelCase) form. */
function toReactAttr(name: string): string {
	if (ATTR_MAP[name]) return ATTR_MAP[name];
	if (name.includes("-")) {
		return name.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
	}
	return name;
}

function toProps(a: Record<string, string>, key: string): Record<string, unknown> {
	const props: Record<string, unknown> = { key };
	for (const [k, v] of Object.entries(a)) props[toReactAttr(k)] = v;
	return props;
}

/** Render a list of SVG nodes to React elements. */
export function renderSvgNodes(nodes: readonly SvgNode[], keyPrefix = "n"): ReactElement[] {
	return nodes.map((node, i) => {
		const key = `${keyPrefix}-${i}`;
		const children = node.c ? renderSvgNodes(node.c, key) : undefined;
		return createElement(node.t, toProps(node.a, key), children);
	});
}
