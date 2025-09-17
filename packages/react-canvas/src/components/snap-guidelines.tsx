import type { SnapGuide } from "@usketch/tools";
import type React from "react";

// Constants for label positioning
const DISTANCE_LABEL_X_OFFSET = 20;
const DISTANCE_LABEL_Y_OFFSET = 4;

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

	const getStrokeColor = (type: string, style?: string) => {
		switch (type) {
			case "distance":
				return "#FF9500"; // Orange for distance
			case "diagonal":
				return "#9B59B6"; // Purple for diagonal alignment
			case "threshold":
				return "#E74C3C"; // Red for snap threshold
			default:
				// Use different blue shades for different styles
				if (style === "solid") return "#0066CC"; // Darker blue for solid alignment
				return "#007AFF"; // Default blue for dashed guides
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
					const strokeColor = getStrokeColor(guide.type, guide.style);
					const strokeDasharray = getStrokeDashArray(guide.style);
					const strokeOpacity = guide.style === "solid" ? 0.8 : 0.6;
					const strokeWidth = guide.style === "solid" ? 1.5 / camera.zoom : 1 / camera.zoom;

					return (
						<g key={`${guide.type}-${guide.position}-${index}`}>
							<line
								x1={guide.start.x}
								y1={guide.start.y}
								x2={guide.end.x}
								y2={guide.end.y}
								stroke={strokeColor}
								strokeWidth={strokeWidth}
								strokeDasharray={strokeDasharray}
								opacity={strokeOpacity}
							/>
							{/* Add end caps for solid alignment guides */}
							{guide.style === "solid" && guide.type !== "distance" && (
								<>
									<circle
										cx={guide.start.x}
										cy={guide.start.y}
										r={3 / camera.zoom}
										fill={strokeColor}
										opacity={strokeOpacity}
									/>
									<circle
										cx={guide.end.x}
										cy={guide.end.y}
										r={3 / camera.zoom}
										fill={strokeColor}
										opacity={strokeOpacity}
									/>
								</>
							)}
							{/* Special rendering for diagonal guides */}
							{guide.type === "diagonal" && guide.label && (
								<text
									x={(guide.start.x + guide.end.x) / 2}
									y={(guide.start.y + guide.end.y) / 2 - 10}
									fill={strokeColor}
									fontSize={12 / camera.zoom}
									textAnchor="middle"
									fontFamily="monospace"
									fontWeight="bold"
								>
									{guide.label}
								</text>
							)}
							{/* Special rendering for threshold guides */}
							{guide.type === "threshold" && guide.label && (
								<>
									<rect
										x={(guide.start.x + guide.end.x) / 2 - 20}
										y={(guide.start.y + guide.end.y) / 2 - 8}
										width={40}
										height={16}
										fill="white"
										opacity={0.8}
										rx={2}
										ry={2}
									/>
									<text
										x={(guide.start.x + guide.end.x) / 2}
										y={(guide.start.y + guide.end.y) / 2 + 4}
										fill={strokeColor}
										fontSize={10 / camera.zoom}
										textAnchor="middle"
										fontFamily="monospace"
									>
										{guide.label}
									</text>
								</>
							)}
							{guide.type === "distance" && guide.distance !== undefined && (
								<>
									{/* Distance label background */}
									<rect
										x={(guide.start.x + guide.end.x) / 2 - (guide.label === "=" ? 10 : 15)}
										y={(guide.start.y + guide.end.y) / 2 - 8}
										width={guide.label === "=" ? 20 : 30}
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
										{guide.label === "=" ? "=" : guide.distance}
									</text>
									{/* Show distance value next to = sign if both are present */}
									{guide.label === "=" && (
										<text
											x={(guide.start.x + guide.end.x) / 2 + DISTANCE_LABEL_X_OFFSET / camera.zoom}
											y={(guide.start.y + guide.end.y) / 2 + DISTANCE_LABEL_Y_OFFSET}
											fill={strokeColor}
											fontSize={10 / camera.zoom}
											textAnchor="start"
											fontFamily="monospace"
											opacity={0.7}
										>
											{guide.distance}px
										</text>
									)}
								</>
							)}
						</g>
					);
				})}
			</g>
		</svg>
	);
};
