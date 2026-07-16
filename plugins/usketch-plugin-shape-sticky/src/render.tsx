import { editableTextProps } from "@edv4h/usketch-shape-utils";
import type { ShapeData } from "@edv4h/usketch-shared";
import { DEFAULT_STICKY_COLOR, STICKY_COLORS } from "./constants.js";
import type { StickyShapeData } from "./types.js";

function getStickyBackground(data: StickyShapeData): string {
	const colorKey = data.stickyColor ?? DEFAULT_STICKY_COLOR;
	if (data.style.fill !== "transparent" && data.style.fill !== STICKY_COLORS[colorKey]) {
		return data.style.fill;
	}
	return STICKY_COLORS[colorKey] ?? STICKY_COLORS[DEFAULT_STICKY_COLOR];
}

const baseStickyStyle = (data: StickyShapeData): React.CSSProperties => ({
	width: "100%",
	background: getStickyBackground(data),
	borderRadius: 8,
	boxShadow: "2px 3px 8px rgba(0,0,0,0.12)",
	padding: 12,
	boxSizing: "border-box",
	fontFamily: "system-ui, sans-serif",
	fontSize: data.fontSize ?? 16,
	color: "#1e1e1e",
	lineHeight: 1.4,
	whiteSpace: "pre-wrap",
	wordBreak: "break-word",
	outline: "none",
});

export function render(shape: ShapeData) {
	const data = shape as StickyShapeData;
	if (!data.isEditing) {
		return (
			<div
				style={{
					...baseStickyStyle(data),
					height: "100%",
					overflow: "hidden",
					pointerEvents: "none",
					userSelect: "none",
				}}
			>
				{data.text ?? ""}
			</div>
		);
	}

	return (
		// biome-ignore lint/a11y/useSemanticElements: contentEditable div is standard for rich text editing
		<div
			{...editableTextProps(data.id, data.text ?? "")}
			style={{
				...baseStickyStyle(data),
				height: "100%",
				overflow: "auto",
				cursor: "text",
				pointerEvents: "auto",
				userSelect: "auto",
			}}
		/>
	);
}
