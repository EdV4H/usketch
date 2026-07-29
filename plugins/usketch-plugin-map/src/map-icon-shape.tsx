// `map-icon` — a placed landmark/object/marker. A normal selectable/movable/
// resizable SVG shape (foreground, above the terrain MapLayer). The icon kind is
// stored in `meta.iconKey`; the SVG markup comes from the design (icons.ts).
import type {
	BoundingBox,
	Point,
	ResizeHandle,
	ShapeData,
	ShapeDefinition,
} from "@edv4h/usketch-shared";
import { generateId, withRotation } from "@edv4h/usketch-shared";
import { ICONS_BY_KEY, type IconCategory } from "./icons.js";
import { WOBBLE_FILTER_ID } from "./map-layer.js";
import { terrainCssVars } from "./palette.js";
import { useRenderConfig } from "./render-config.js";
import { renderSvgNodes } from "./svg-nodes.js";

export const MAP_ICON_TYPE = "map-icon";
export const DEFAULT_ICON_SIZE = 48;

export interface MapIconShapeData extends ShapeData {
	type: "map-icon";
	meta: {
		iconKey: string;
		category: IconCategory;
		/** Set when this icon has been used as a base "beacon" (see assignRadiusFromIcon). */
		baseId?: string;
		/** Base radius in tiles that was stamped from this icon. */
		baseRadius?: number;
	};
}

export function makeMapIcon(
	iconKey: string,
	category: IconCategory,
	x: number,
	y: number,
	size = DEFAULT_ICON_SIZE,
): MapIconShapeData {
	return {
		id: generateId(),
		type: "map-icon",
		x: Math.round(x - size / 2),
		y: Math.round(y - size / 2),
		width: size,
		height: size,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		meta: { iconKey, category },
	};
}

function parseViewBox(vb: string): [number, number, number, number] {
	const p = vb.split(/[\s,]+/).map(Number);
	return [p[0] || 0, p[1] || 0, p[2] || 48, p[3] || 48];
}

function MapIconBody({ data }: { data: MapIconShapeData }) {
	const cfg = useRenderConfig();
	const icon = ICONS_BY_KEY.get(data.meta?.iconKey ?? "");
	if (!icon) return <g />;
	const [vx, vy, vw, vh] = parseViewBox(icon.viewBox);
	const sx = data.width / vw;
	const sy = data.height / vh;
	const cssVars = terrainCssVars(cfg.colorMode, cfg.strokeScale);
	return (
		<g
			style={cssVars as React.CSSProperties}
			filter={cfg.lineStyle === "wobble" ? `url(#${WOBBLE_FILTER_ID})` : undefined}
		>
			<g transform={`translate(${data.x} ${data.y}) scale(${sx} ${sy}) translate(${-vx} ${-vy})`}>
				{renderSvgNodes(icon.nodes, `icon-${icon.key}`)}
			</g>
		</g>
	);
}

function baseHitTest(data: ShapeData, point: Point): boolean {
	return (
		point.x >= data.x &&
		point.x <= data.x + data.width &&
		point.y >= data.y &&
		point.y <= data.y + data.height
	);
}

function resize(data: ShapeData, handle: ResizeHandle, delta: Point): ShapeData {
	let { x, y, width, height } = data;
	switch (handle) {
		case "se":
			width += delta.x;
			height += delta.y;
			break;
		case "nw":
			x += delta.x;
			y += delta.y;
			width -= delta.x;
			height -= delta.y;
			break;
		case "ne":
			y += delta.y;
			width += delta.x;
			height -= delta.y;
			break;
		case "sw":
			x += delta.x;
			width -= delta.x;
			height += delta.y;
			break;
		case "e":
			width += delta.x;
			break;
		case "w":
			x += delta.x;
			width -= delta.x;
			break;
		case "n":
			y += delta.y;
			height -= delta.y;
			break;
		case "s":
			height += delta.y;
			break;
	}
	return { ...data, x, y, width: Math.max(16, width), height: Math.max(16, height) };
}

export const mapIconShapeDefinition: ShapeDefinition = {
	render: (data) => <MapIconBody data={data as MapIconShapeData} />,
	renderTarget: "svg",
	getBounds: (data): BoundingBox => ({
		x: data.x,
		y: data.y,
		width: data.width,
		height: data.height,
	}),
	hitTest: withRotation(baseHitTest),
	resize,
	minSize: { width: 16, height: 16 },
	createDefault: (params): ShapeData => makeMapIcon("town", "landmark", params.x, params.y),
	serializeForAi: (data): Record<string, unknown> => {
		const d = data as MapIconShapeData;
		const icon = ICONS_BY_KEY.get(d.meta?.iconKey ?? "");
		return { kind: "map-icon", icon: d.meta?.iconKey, text: icon?.en };
	},
	debugFields: (data): Record<string, unknown> => {
		const d = data as MapIconShapeData;
		return { iconKey: d.meta?.iconKey, category: d.meta?.category };
	},
};
