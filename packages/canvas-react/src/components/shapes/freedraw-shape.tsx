import type { Shape } from "@usketch/shared-types";
import type React from "react";

interface FreedrawShapeProps {
	shape: Shape & { points: Array<{ x: number; y: number }>; width?: number; height?: number };
}

export const FreedrawShape: React.FC<FreedrawShapeProps> = ({ shape }) => {
	const shapeX = shape.x || 0;
	const shapeY = shape.y || 0;
	const width = shape.width || 100;
	const height = shape.height || 100;
	const strokeWidth = shape.strokeWidth || 2;

	// Build path data
	const pathData = shape.points
		.map((point, index) => {
			const x = point.x - shapeX;
			const y = point.y - shapeY;
			return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
		})
		.join(" ");

	return (
		<div
			data-shape-id={shape.id}
			data-shape-type="freedraw"
			data-shape="true"
			style={{
				position: "absolute",
				left: shapeX,
				top: shapeY,
				width,
				height,
				transform: `rotate(${shape.rotation}deg)`,
				transformOrigin: "center",
				opacity: shape.opacity,
				pointerEvents: "auto",
			}}
		>
			<svg
				width={width}
				height={height}
				aria-label="Freedraw shape"
				role="img"
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
					overflow: "visible",
				}}
			>
				<path
					d={pathData}
					stroke={shape.strokeColor}
					strokeWidth={strokeWidth}
					fill="none"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		</div>
	);
};
