import type { ShapePlugin } from "@usketch/shape-registry";
import type React from "react";
import { useState } from "react";

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

// Define the chart shape data structure
export interface ChartHybridShape extends CustomBaseShape {
	type: "chart-hybrid";
	data: number[];
	title: string;
	color: string;
}

// React component for the chart (SVG-based)
const ChartComponent: React.FC<{
	shape: ChartHybridShape;
	isSelected?: boolean;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}> = ({ shape, isSelected, onClick, onPointerDown, onPointerMove, onPointerUp }) => {
	const [hoveredBar, setHoveredBar] = useState<number | null>(null);
	const [localData, setLocalData] = useState(shape.data);

	const maxValue = Math.max(...localData, 1);
	const barWidth = (shape.width - 40) / localData.length;
	const titleHeight = 30;
	const chartHeight = shape.height - titleHeight;

	const handleBarClick = (index: number, e: React.MouseEvent) => {
		e.stopPropagation();
		const newData = [...localData];
		newData[index] = Math.floor(Math.random() * 100) + 10;
		setLocalData(newData);
	};

	return (
		<g
			role="button"
			onClick={onClick}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
		>
			{/* Background */}
			<rect
				x={shape.x}
				y={shape.y}
				width={shape.width}
				height={shape.height}
				fill="white"
				stroke="#333"
				strokeWidth={2}
				rx={8}
			/>

			{/* Title */}
			<rect
				x={shape.x}
				y={shape.y}
				width={shape.width}
				height={titleHeight}
				fill="#f5f5f5"
				stroke="#333"
				strokeWidth={2}
				rx={8}
			/>
			<text
				x={shape.x + shape.width / 2}
				y={shape.y + titleHeight / 2}
				fill="#333"
				fontSize="14"
				fontWeight="bold"
				textAnchor="middle"
				dominantBaseline="middle"
				style={{ userSelect: "none" }}
			>
				{shape.title}
			</text>

			{/* Grid lines */}
			{[0, 25, 50, 75, 100].map((percentage) => (
				<line
					key={percentage}
					x1={shape.x + 20}
					x2={shape.x + shape.width - 20}
					y1={shape.y + titleHeight + chartHeight - (chartHeight * percentage) / 100}
					y2={shape.y + titleHeight + chartHeight - (chartHeight * percentage) / 100}
					stroke="#e0e0e0"
					strokeWidth="1"
					strokeDasharray="3,3"
				/>
			))}

			{/* Bars */}
			{localData.map((value, index) => {
				const barHeight = (value / maxValue) * (chartHeight - 20);
				const x = shape.x + 20 + index * barWidth + barWidth * 0.1;
				const y = shape.y + titleHeight + chartHeight - barHeight - 10;
				const isHovered = hoveredBar === index;

				return (
					<g key={index}>
						<rect
							role="button"
							x={x}
							y={y}
							width={barWidth * 0.8}
							height={barHeight}
							fill={isHovered ? shape.color : `${shape.color}88`}
							stroke={shape.color}
							strokeWidth="2"
							rx="4"
							style={{ cursor: "pointer" }}
							onMouseEnter={() => setHoveredBar(index)}
							onMouseLeave={() => setHoveredBar(null)}
							onClick={(e) => handleBarClick(index, e)}
						/>
						{/* Value label */}
						<text
							x={x + barWidth * 0.4}
							y={y - 5}
							fontSize="10"
							fill="#333"
							textAnchor="middle"
							style={{ pointerEvents: "none", userSelect: "none" }}
						>
							{value}
						</text>
						{/* X-axis label */}
						<text
							x={x + barWidth * 0.4}
							y={shape.y + titleHeight + chartHeight - 2}
							fontSize="10"
							fill="#666"
							textAnchor="middle"
							style={{ userSelect: "none" }}
						>
							{String.fromCharCode(65 + index)}
						</text>
					</g>
				);
			})}

			{/* Tooltip */}
			{hoveredBar !== null && (
				<g>
					<rect
						x={shape.x + 20 + hoveredBar * barWidth + barWidth * 0.5 - 60}
						y={shape.y + titleHeight + 10}
						width={120}
						height={20}
						fill="rgba(0,0,0,0.8)"
						rx="4"
					/>
					<text
						x={shape.x + 20 + hoveredBar * barWidth + barWidth * 0.5}
						y={shape.y + titleHeight + 20}
						fill="white"
						fontSize="12"
						textAnchor="middle"
						style={{ userSelect: "none" }}
					>
						Click to randomize
					</text>
				</g>
			)}

			{/* Selection highlight */}
			{isSelected && (
				<rect
					x={shape.x}
					y={shape.y}
					width={shape.width}
					height={shape.height}
					fill="none"
					stroke="#0066FF"
					strokeWidth={2}
					strokeDasharray="5,5"
					opacity={0.5}
					style={{ pointerEvents: "none" }}
					rx={8}
				/>
			)}
		</g>
	);
};

export const chartHybridPlugin: ShapePlugin<ChartHybridShape> = {
	type: "chart-hybrid",
	component: ChartComponent,
	createDefaultShape: (props: {
		id: string;
		x: number;
		y: number;
		width?: number;
		height?: number;
	}) => ({
		id: props.id,
		type: "chart-hybrid" as const,
		x: props.x,
		y: props.y,
		width: props.width || 300,
		height: props.height || 200,
		rotation: 0,
		opacity: 1,
		strokeColor: "#333333",
		fillColor: "#FFFFFF",
		strokeWidth: 2,
		data: [75, 45, 90, 30, 60, 85],
		title: "Interactive Bar Chart",
		color: "#4ECDC4",
	}),
	getBounds: (shape: ChartHybridShape) => ({
		x: shape.x,
		y: shape.y,
		width: shape.width,
		height: shape.height,
	}),
	hitTest: (shape: ChartHybridShape, point: { x: number; y: number }) => {
		return (
			point.x >= shape.x &&
			point.x <= shape.x + shape.width &&
			point.y >= shape.y &&
			point.y <= shape.y + shape.height
		);
	},
};
