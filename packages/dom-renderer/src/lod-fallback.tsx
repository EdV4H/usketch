import type { ShapeData } from "@edv4h/usketch-shared";

/**
 * Default lightweight component used when a shape has no `simplifiedComponent`
 * defined. Renders a solid-fill rectangle matching the shape's bounds and fill
 * color. Pointer events are disabled because LOD mode is for read-only zoomed
 * out viewing.
 */
export function LodFallback({ shape }: { shape: ShapeData }) {
	const style = (shape.style ?? {}) as { fill?: string };
	return (
		<div
			style={{
				position: "absolute",
				left: shape.x,
				top: shape.y,
				width: shape.width,
				height: shape.height,
				backgroundColor: style.fill || "#cccccc",
				pointerEvents: "none",
			}}
		/>
	);
}
