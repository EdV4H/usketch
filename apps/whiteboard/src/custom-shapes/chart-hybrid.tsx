import type { BaseShapeConfig, Bounds } from "@usketch/shape-abstraction";
import { BaseShape } from "@usketch/shape-abstraction";
import { UnifiedShapePluginAdapter } from "@usketch/shape-registry";
import type React from "react";
import { useState } from "react";

// Define the chart shape data structure
export interface ChartHybridShape {
	id: string;
	type: "chart-hybrid-unified";
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	opacity: number;
	data: number[];
	title: string;
	color: string;
}

/**
 * Hybrid Chart Shape combining SVG and HTML
 * Demonstrates the power of hybrid rendering mode
 */
class ChartHybrid extends BaseShape<ChartHybridShape> {
	constructor(shape: ChartHybridShape, config: BaseShapeConfig<ChartHybridShape>) {
		super(shape, {
			...config,
			renderMode: "hybrid", // Use hybrid mode for SVG + HTML
			enableInteractivity: true,
		});
	}

	render(): React.ReactElement {
		return <ChartComponent shape={this.shape} onDataUpdate={this.handleDataUpdate} />;
	}

	getBounds(): Bounds {
		return {
			x: this.shape.x,
			y: this.shape.y,
			width: this.shape.width,
			height: this.shape.height,
		};
	}

	hitTest(point: { x: number; y: number }): boolean {
		const bounds = this.getBounds();
		return (
			point.x >= bounds.x &&
			point.x <= bounds.x + bounds.width &&
			point.y >= bounds.y &&
			point.y <= bounds.y + bounds.height
		);
	}

	private handleDataUpdate = (data: number[]) => {
		// Use updateShape to trigger a proper state update
		this.updateShape({ data } as Partial<ChartHybridShape>);
	};
}

// React component combining SVG and HTML
const ChartComponent: React.FC<{
	shape: ChartHybridShape;
	onDataUpdate: (data: number[]) => void;
}> = ({ shape, onDataUpdate }) => {
	const [hoveredBar, setHoveredBar] = useState<number | null>(null);

	const maxValue = Math.max(...shape.data, 1);
	const barWidth = (shape.width - 40) / shape.data.length;
	const chartHeight = shape.height - 60;

	const handleBarClick = (index: number, e: React.MouseEvent) => {
		// Stop propagation to prevent shape selection
		e.stopPropagation();
		e.preventDefault();

		const newData = [...shape.data];
		newData[index] = Math.floor(Math.random() * 100) + 10;
		onDataUpdate(newData);
	};

	return (
		<div
			style={{
				position: "relative",
				left: 0,
				top: 0,
				width: shape.width,
				height: shape.height,
				opacity: shape.opacity,
				transform: `rotate(${shape.rotation}deg)`,
				transformOrigin: "center",
			}}
		>
			{/* HTML part - Title and controls */}
			<div
				style={{
					background: "white",
					border: "2px solid #333",
					borderRadius: "8px 8px 0 0",
					padding: "8px",
					borderBottom: "none",
				}}
			>
				<div
					style={{
						fontSize: "14px",
						fontWeight: "bold",
						color: "#333",
						textAlign: "center",
					}}
				>
					{shape.title}
				</div>
			</div>

			{/* SVG part - Chart visualization */}
			<svg
				width={shape.width}
				height={chartHeight}
				style={{
					background: "white",
					border: "2px solid #333",
					borderTop: "none",
					borderRadius: "0 0 8px 8px",
				}}
			>
				<title>{shape.title}</title>
				{/* Grid lines */}
				{[0, 25, 50, 75, 100].map((percentage) => (
					<line
						key={percentage}
						x1={20}
						x2={shape.width - 20}
						y1={chartHeight - (chartHeight * percentage) / 100}
						y2={chartHeight - (chartHeight * percentage) / 100}
						stroke="#e0e0e0"
						strokeWidth="1"
						strokeDasharray="3,3"
					/>
				))}

				{/* Bars */}
				{shape.data.map((value, index) => {
					const barHeight = (value / maxValue) * (chartHeight - 20);
					const x = 20 + index * barWidth + barWidth * 0.1;
					const y = chartHeight - barHeight - 10;
					const isHovered = hoveredBar === index;

					return (
						<g key={index}>
							<rect
								role="button"
								tabIndex={0}
								x={x}
								y={y}
								width={barWidth * 0.8}
								height={barHeight}
								fill={isHovered ? shape.color : `${shape.color}88`}
								stroke={shape.color}
								strokeWidth="2"
								rx="4"
								ry="4"
								style={{
									cursor: "pointer",
									transition: "fill 0.2s",
								}}
								onMouseEnter={() => setHoveredBar(index)}
								onMouseLeave={() => setHoveredBar(null)}
								onPointerDown={(e) => {
									e.stopPropagation();
								}}
								onClick={(e) => {
									handleBarClick(index, e);
								}}
							/>
							{/* Value label */}
							<text
								x={x + barWidth * 0.4}
								y={y - 5}
								fontSize="10"
								fill="#333"
								textAnchor="middle"
								style={{ pointerEvents: "none" }}
							>
								{value}
							</text>
						</g>
					);
				})}

				{/* X-axis labels */}
				{shape.data.map((_, index) => (
					<text
						key={`label-${index}`}
						x={20 + index * barWidth + barWidth * 0.5}
						y={chartHeight - 2}
						fontSize="10"
						fill="#666"
						textAnchor="middle"
					>
						{String.fromCharCode(65 + index)}
					</text>
				))}
			</svg>

			{/* HTML overlay - Tooltip */}
			{hoveredBar !== null && (
				<div
					style={{
						position: "absolute",
						left: 20 + hoveredBar * barWidth + barWidth * 0.5 - 30,
						top: 30,
						background: "rgba(0,0,0,0.8)",
						color: "white",
						padding: "4px 8px",
						borderRadius: "4px",
						fontSize: "12px",
						pointerEvents: "none",
						zIndex: 10,
					}}
				>
					Click to randomize
				</div>
			)}
		</div>
	);
};

// Create the plugin using the adapter
export const chartHybridPlugin = UnifiedShapePluginAdapter.fromBaseShape(
	"chart-hybrid-unified",
	ChartHybrid as any,
	(props: { id: string; x: number; y: number; width?: number; height?: number }) =>
		({
			id: props.id,
			type: "chart-hybrid-unified",
			x: props.x,
			y: props.y,
			width: props.width || 300,
			height: props.height || 200,
			rotation: 0,
			opacity: 1,
			data: [75, 45, 90, 30, 60, 85],
			title: "Interactive Bar Chart",
			color: "#4ECDC4",
		}) as any,
	"Chart (Hybrid)",
) as any;
