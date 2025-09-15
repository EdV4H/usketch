import type { SnapGuide } from "@usketch/tools";
import type React from "react";

interface SnapGuidelinesProps {
	guides: SnapGuide[];
	camera: {
		x: number;
		y: number;
		zoom: number;
	};
}

export const SnapGuidelines: React.FC<SnapGuidelinesProps> = ({ guides, camera }) => {
	if (!guides || guides.length === 0) {
		return null;
	}

	return (
		<svg
			className="snap-guidelines"
			role="presentation"
			aria-hidden="true"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
				zIndex: 1000,
			}}
		>
			<g transform={`translate(${camera.x}, ${camera.y}) scale(${camera.zoom})`}>
				{guides.map((guide, index) => (
					<line
						key={`${guide.type}-${guide.position}-${index}`}
						x1={guide.start.x}
						y1={guide.start.y}
						x2={guide.end.x}
						y2={guide.end.y}
						stroke="#007AFF"
						strokeWidth={1 / camera.zoom}
						strokeDasharray="5,5"
						opacity={0.6}
					/>
				))}
			</g>
		</svg>
	);
};
