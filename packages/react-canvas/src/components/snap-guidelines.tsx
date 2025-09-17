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

	const getStrokeDashArray = (style?: "solid" | "dashed" | "dotted") => {
		switch (style) {
			case "solid":
				return "none";
			case "dotted":
				return "2,2";
			default:
				return "5,5";
		}
	};

	const getStrokeColor = (type: string) => {
		switch (type) {
			case "distance":
				return "#FF9500"; // Orange for distance
			default:
				return "#007AFF"; // Blue for alignment
		}
	};

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
				{guides.map((guide, index) => {
					const strokeColor = getStrokeColor(guide.type);
					const strokeDasharray = getStrokeDashArray(guide.style);

					return (
						<g key={`${guide.type}-${guide.position}-${index}`}>
							<line
								x1={guide.start.x}
								y1={guide.start.y}
								x2={guide.end.x}
								y2={guide.end.y}
								stroke={strokeColor}
								strokeWidth={1 / camera.zoom}
								strokeDasharray={strokeDasharray}
								opacity={0.6}
							/>
							{guide.type === "distance" && guide.distance !== undefined && (
								<>
									{/* Distance label background */}
									<rect
										x={(guide.start.x + guide.end.x) / 2 - 15}
										y={(guide.start.y + guide.end.y) / 2 - 8}
										width={30}
										height={16}
										fill="white"
										opacity={0.9}
										rx={2}
										ry={2}
									/>
									{/* Distance label text */}
									<text
										x={(guide.start.x + guide.end.x) / 2}
										y={(guide.start.y + guide.end.y) / 2 + 4}
										fill={strokeColor}
										fontSize={12 / camera.zoom}
										textAnchor="middle"
										fontFamily="monospace"
										fontWeight="bold"
									>
										{guide.distance}
									</text>
								</>
							)}
						</g>
					);
				})}
			</g>
		</svg>
	);
};
