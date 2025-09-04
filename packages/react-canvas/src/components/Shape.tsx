import type { Shape as ShapeType } from "@usketch/shared-types";
import * as React from "react";

interface ShapeProps {
	shape: ShapeType;
}

export const Shape: React.FC<ShapeProps> = React.memo(({ shape }) => {
	const getShapeStyle = (): React.CSSProperties => {
		const baseStyle: React.CSSProperties = {
			position: "absolute",
			left: shape.x,
			top: shape.y,
			pointerEvents: "auto",
		};

		if (shape.type === "rectangle") {
			return {
				...baseStyle,
				width: shape.width,
				height: shape.height,
				backgroundColor: shape.fillColor || "transparent",
				border: shape.strokeWidth
					? `${shape.strokeWidth}px solid ${shape.strokeColor || "#000"}`
					: "none",
				opacity: shape.opacity ?? 1,
				transform: shape.rotation ? `rotate(${shape.rotation}deg)` : undefined,
			};
		}

		if (shape.type === "ellipse") {
			return {
				...baseStyle,
				width: shape.width,
				height: shape.height,
				borderRadius: "50%",
				backgroundColor: shape.fillColor || "transparent",
				border: shape.strokeWidth
					? `${shape.strokeWidth}px solid ${shape.strokeColor || "#000"}`
					: "none",
				opacity: shape.opacity ?? 1,
				transform: shape.rotation ? `rotate(${shape.rotation}deg)` : undefined,
			};
		}

		if (shape.type === "freedraw") {
			return {
				...baseStyle,
				width: shape.width,
				height: shape.height,
				opacity: shape.opacity ?? 1,
			};
		}

		return baseStyle;
	};

	if (shape.type === "freedraw" && shape.path) {
		// Render freedraw as SVG
		return (
			<div
				className={`shape shape-${shape.type}`}
				data-shape-id={shape.id}
				data-shape-type={shape.type}
				style={getShapeStyle()}
			>
				<svg
					aria-label="Freedraw shape"
					width={shape.width}
					height={shape.height}
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						overflow: "visible",
					}}
				>
					<path
						d={shape.path}
						fill="none"
						stroke={shape.strokeColor || "#000"}
						strokeWidth={shape.strokeWidth || 2}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</div>
		);
	}

	return (
		<div
			className={`shape shape-${shape.type}`}
			data-shape-id={shape.id}
			data-shape-type={shape.type}
			data-testid={`shape-${shape.type}-${shape.id.slice(0, 8)}`}
			style={getShapeStyle()}
		/>
	);
});
