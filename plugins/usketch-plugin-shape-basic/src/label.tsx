import { editableTextProps } from "@edv4h/usketch-shape-utils";
import type { ShapeData } from "@edv4h/usketch-shared";
import type { GeoTextData } from "./types.js";

/** 2D geo shape types that support an editable centered label. */
export const LABELABLE_TYPES = new Set([
	"rectangle",
	"rounded-rect",
	"ellipse",
	"triangle",
	"diamond",
	"star",
]);

type GeoShape = ShapeData & GeoTextData;

const centerContainer: React.CSSProperties = {
	width: "100%",
	height: "100%",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	boxSizing: "border-box",
	padding: 6,
};

const textBase = (data: GeoShape): React.CSSProperties => ({
	fontFamily: "system-ui, sans-serif",
	fontSize: data.fontSize ?? 14,
	color: "#1e1e1e",
	lineHeight: 1.3,
	textAlign: "center",
	whiteSpace: "pre-wrap",
	wordBreak: "break-word",
	outline: "none",
});

/**
 * Centered editable label for a geo shape, rendered as an SVG `<foreignObject>`
 * over the shape's bounds. View mode is a pointer-transparent div; edit mode is
 * a contentEditable div wired to the shared editable-text controller. Returns
 * null in view mode when there's no text (so it never blocks shape hit-testing).
 */
function GeoLabel({ data }: { data: GeoShape }) {
	const editing = data.isEditing === true;
	const text = data.text ?? "";
	if (!editing && text.trim() === "") return null;

	return (
		<foreignObject
			x={data.x}
			y={data.y}
			width={Math.max(0, data.width)}
			height={Math.max(0, data.height)}
			style={{ overflow: "hidden" }}
		>
			<div
				// XHTML namespace on the foreignObject root for correct cross-browser SVG rendering
				// (React's HTMLDivElement type omits `xmlns`, so it's applied as a raw attribute).
				{...({ xmlns: "http://www.w3.org/1999/xhtml" } as Record<string, string>)}
				style={{ ...centerContainer, pointerEvents: editing ? "auto" : "none" }}
			>
				{editing ? (
					// biome-ignore lint/a11y/useSemanticElements: contentEditable div is standard for text editing
					<div
						{...editableTextProps(data.id, text)}
						style={{ ...textBase(data), cursor: "text", userSelect: "auto", maxWidth: "100%" }}
					/>
				) : (
					<div style={{ ...textBase(data), userSelect: "none", overflow: "hidden" }}>{text}</div>
				)}
			</div>
		</foreignObject>
	);
}

/** Wrap a shape renderer so its output is grouped with an editable label. */
export function withLabel(
	renderer: (data: ShapeData) => React.ReactElement,
): (data: ShapeData) => React.ReactElement {
	return (data: ShapeData) => (
		<g>
			{renderer(data)}
			<GeoLabel data={data as GeoShape} />
		</g>
	);
}
