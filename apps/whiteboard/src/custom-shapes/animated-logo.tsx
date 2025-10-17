import type { ShapePlugin } from "@usketch/shape-registry";
import type React from "react";
import { useEffect, useState } from "react";

// Custom base shape interface
interface CustomBaseShape {
	id: string;
	type: string;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	opacity: number;
	strokeColor: string;
	fillColor: string;
	strokeWidth: number;
}

// Define the animated logo shape data structure
export interface AnimatedLogoShape extends CustomBaseShape {
	type: "animated-logo";
	primaryColor: string;
	secondaryColor: string;
	animationSpeed: number;
}

// React component for the animated logo
const AnimatedLogoComponent: React.FC<{
	shape: AnimatedLogoShape;
	isSelected?: boolean;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}> = ({ shape, isSelected, onClick, onPointerDown, onPointerMove, onPointerUp }) => {
	const [rotation, setRotation] = useState(0);
	const [scale, setScale] = useState(1);
	const [hovered, _setHovered] = useState(false);

	useEffect(() => {
		const interval = setInterval(() => {
			setRotation((prev) => (prev + shape.animationSpeed) % 360);
		}, 50);

		return () => clearInterval(interval);
	}, [shape.animationSpeed]);

	useEffect(() => {
		if (hovered) {
			setScale(1.2);
		} else {
			setScale(1);
		}
	}, [hovered]);

	const centerX = shape.width / 2;
	const centerY = shape.height / 2;
	const radius = Math.min(centerX, centerY) * 0.4;

	return (
		<g
			role="button"
			transform={`translate(${shape.x}, ${shape.y})`}
			opacity={shape.opacity}
			style={{ cursor: "pointer" }}
			onClick={onClick}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
		>
			{/* Inner group for rotation */}
			<g transform={`rotate(${shape.rotation}, ${centerX}, ${centerY})`}>
				{/* Background circle */}
				<circle
					cx={centerX}
					cy={centerY}
					r={radius * 2}
					fill="white"
					stroke="#333"
					strokeWidth="2"
				/>

				{/* Animated outer ring */}
				<g transform={`rotate(${rotation}, ${centerX}, ${centerY})`}>
					<circle
						cx={centerX}
						cy={centerY}
						r={radius * 1.5}
						fill="none"
						stroke={shape.primaryColor}
						strokeWidth="3"
						strokeDasharray="10 5"
						opacity="0.7"
					>
						<animateTransform
							attributeName="transform"
							type="rotate"
							from={`0 ${centerX} ${centerY}`}
							to={`360 ${centerX} ${centerY}`}
							dur="10s"
							repeatCount="indefinite"
						/>
					</circle>
				</g>

				{/* Central animated element */}
				<g
					transform={`translate(${centerX}, ${centerY}) scale(${scale})`}
					style={{ transition: "transform 0.3s ease" }}
				>
					{/* Hexagon shape */}
					<polygon
						points={generateHexagonPoints(radius)}
						fill={shape.primaryColor}
						stroke={shape.secondaryColor}
						strokeWidth="2"
						transform={`rotate(${-rotation * 2})`}
					>
						<animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
					</polygon>

					{/* Inner rotating triangles */}
					{[0, 120, 240].map((angle, index) => (
						<polygon
							key={index}
							points={generateTrianglePoints(radius * 0.5)}
							fill={shape.secondaryColor}
							opacity="0.6"
							transform={`rotate(${angle + rotation * 3})`}
						>
							<animateTransform
								attributeName="transform"
								type="rotate"
								from={`${angle} 0 0`}
								to={`${angle + 360} 0 0`}
								dur={`${3 + index}s`}
								repeatCount="indefinite"
							/>
						</polygon>
					))}

					{/* Center circle */}
					<circle cx="0" cy="0" r={radius * 0.2} fill="white">
						<animate
							attributeName="r"
							values={`${radius * 0.2};${radius * 0.3};${radius * 0.2}`}
							dur="1.5s"
							repeatCount="indefinite"
						/>
					</circle>
				</g>

				{/* Orbiting dots */}
				{[0, 90, 180, 270].map((angle, index) => {
					const orbitRadius = radius * 1.8;
					const dotX = centerX + Math.cos((angle + rotation) * (Math.PI / 180)) * orbitRadius;
					const dotY = centerY + Math.sin((angle + rotation) * (Math.PI / 180)) * orbitRadius;

					return (
						<circle
							key={index}
							cx={dotX}
							cy={dotY}
							r="4"
							fill={index % 2 === 0 ? shape.primaryColor : shape.secondaryColor}
						>
							<animate
								attributeName="r"
								values="4;6;4"
								dur={`${1 + index * 0.2}s`}
								repeatCount="indefinite"
							/>
							<animate
								attributeName="opacity"
								values="1;0.5;1"
								dur={`${1.5 + index * 0.1}s`}
								repeatCount="indefinite"
							/>
						</circle>
					);
				})}

				{/* Text label */}
				<text
					x={centerX}
					y={shape.height - 10}
					fontSize="12"
					fill="#333"
					textAnchor="middle"
					fontWeight="bold"
				>
					Animated Logo
				</text>
			</g>

			{/* Selection highlight */}
			{isSelected && (
				<rect
					x={0}
					y={0}
					width={shape.width}
					height={shape.height}
					fill="none"
					stroke="#0066FF"
					strokeWidth={2}
					strokeDasharray="5,5"
					opacity={0.5}
					style={{ pointerEvents: "none" }}
				/>
			)}
		</g>
	);
};

// Helper functions to generate polygon points
function generateHexagonPoints(radius: number): string {
	const points: string[] = [];
	for (let i = 0; i < 6; i++) {
		const angle = (i * 60 - 30) * (Math.PI / 180);
		const x = Math.cos(angle) * radius;
		const y = Math.sin(angle) * radius;
		points.push(`${x},${y}`);
	}
	return points.join(" ");
}

function generateTrianglePoints(radius: number): string {
	const points: string[] = [];
	for (let i = 0; i < 3; i++) {
		const angle = (i * 120 - 90) * (Math.PI / 180);
		const x = Math.cos(angle) * radius;
		const y = Math.sin(angle) * radius;
		points.push(`${x},${y}`);
	}
	return points.join(" ");
}

export const animatedLogoPlugin: ShapePlugin<AnimatedLogoShape> = {
	type: "animated-logo",
	component: AnimatedLogoComponent,
	createDefaultShape: (props: {
		id: string;
		x: number;
		y: number;
		width?: number;
		height?: number;
	}) => ({
		id: props.id,
		type: "animated-logo" as const,
		x: props.x,
		y: props.y,
		width: props.width || 200,
		height: props.height || 200,
		rotation: 0,
		opacity: 1,
		strokeColor: "#333333",
		fillColor: "#FFFFFF",
		strokeWidth: 2,
		primaryColor: "#FF6B6B",
		secondaryColor: "#4ECDC4",
		animationSpeed: 1,
	}),
	getBounds: (shape: AnimatedLogoShape) => ({
		x: shape.x,
		y: shape.y,
		width: shape.width,
		height: shape.height,
	}),
	hitTest: (shape: AnimatedLogoShape, point: { x: number; y: number }) => {
		return (
			point.x >= shape.x &&
			point.x <= shape.x + shape.width &&
			point.y >= shape.y &&
			point.y <= shape.y + shape.height
		);
	},
};
