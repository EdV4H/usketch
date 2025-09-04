import type { FreedrawShape } from "@usketch/shared-types";
import type * as React from "react";

interface FreedrawProps {
	shape: FreedrawShape;
}

export const Freedraw: React.FC<FreedrawProps> = ({ shape }) => {
	if (!shape.path) return null;

	return (
		<div
			className="shape-freedraw"
			data-shape-id={shape.id}
			data-shape-type="freedraw"
			style={{
				position: "absolute",
				left: shape.x,
				top: shape.y,
				width: shape.width,
				height: shape.height,
				opacity: shape.opacity ?? 1,
				pointerEvents: "auto",
			}}
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
};
