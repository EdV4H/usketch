import type { ShapePlugin } from "@usketch/shape-registry";
import React, { useState } from "react";

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

// Define the counter shape data structure
export interface HtmlCounterShape extends CustomBaseShape {
	type: "html-counter";
	count: number;
}

// React component for the counter UI (HTML-based)
const CounterComponent: React.FC<{
	shape: HtmlCounterShape;
	isSelected?: boolean;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}> = ({ shape, isSelected }) => {
	const [localCount, setLocalCount] = useState(shape.count);

	React.useEffect(() => {
		setLocalCount(shape.count);
	}, [shape.count]);

	const handleIncrement = (e: React.MouseEvent) => {
		e.stopPropagation();
		setLocalCount((prev) => prev + 1);
	};

	const handleDecrement = (e: React.MouseEvent) => {
		e.stopPropagation();
		setLocalCount((prev) => prev - 1);
	};

	// Calculate actual width: button(40) + gap(10) + counter(width) + gap(10) + button(40) + padding(20)
	const totalWidth = 40 + 10 + shape.width + 10 + 40 + 20;
	const totalHeight = shape.height + 20;

	return (
		<foreignObject x={shape.x} y={shape.y} width={totalWidth} height={totalHeight}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "10px",
					userSelect: "none",
					padding: "10px",
					pointerEvents: "all",
					width: "100%",
					height: "100%",
				}}
			>
				{/* Decrement Button */}
				<button
					type="button"
					onClick={handleDecrement}
					style={{
						width: "40px",
						height: "40px",
						borderRadius: "50%",
						backgroundColor: "#FF6B6B",
						color: "white",
						border: "none",
						fontSize: "24px",
						fontWeight: "bold",
						cursor: "pointer",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						transition: "all 0.3s",
						boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.transform = "scale(1.1)";
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.transform = "scale(1)";
					}}
				>
					−
				</button>

				{/* Counter Display */}
				<div
					style={{
						width: `${shape.width}px`,
						height: `${shape.height}px`,
						backgroundColor: shape.fillColor,
						border: `${shape.strokeWidth}px solid ${shape.strokeColor}`,
						borderRadius: "20px",
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						fontSize: "16px",
						fontWeight: "600",
						boxShadow: isSelected
							? "0 0 0 2px #0066FF, 0 4px 12px rgba(0,0,0,0.08)"
							: "0 4px 12px rgba(0,0,0,0.08)",
						transition: "all 0.3s",
					}}
				>
					<div
						style={{
							fontSize: "14px",
							color: "#888",
							marginBottom: "4px",
							textTransform: "uppercase",
							letterSpacing: "1px",
						}}
					>
						Counter
					</div>
					<div
						style={{
							fontSize: "42px",
							fontWeight: "bold",
							background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
							WebkitBackgroundClip: "text",
							WebkitTextFillColor: "transparent",
							backgroundClip: "text",
						}}
					>
						{localCount}
					</div>
				</div>

				{/* Increment Button */}
				<button
					type="button"
					onClick={handleIncrement}
					style={{
						width: "40px",
						height: "40px",
						borderRadius: "50%",
						backgroundColor: "#51CF66",
						color: "white",
						border: "none",
						fontSize: "24px",
						fontWeight: "bold",
						cursor: "pointer",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						transition: "all 0.3s",
						boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.transform = "scale(1.1)";
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.transform = "scale(1)";
					}}
				>
					+
				</button>
			</div>
		</foreignObject>
	);
};

export const htmlCounterPlugin: ShapePlugin<HtmlCounterShape> = {
	type: "html-counter",
	component: CounterComponent,
	createDefaultShape: (props: {
		id: string;
		x: number;
		y: number;
		width?: number;
		height?: number;
	}) => ({
		id: props.id,
		type: "html-counter" as const,
		x: props.x,
		y: props.y,
		width: props.width || 160,
		height: props.height || 100,
		rotation: 0,
		opacity: 1,
		fillColor: "#FFFFFF",
		strokeColor: "#333333",
		strokeWidth: 3,
		count: 0,
	}),
	getBounds: (shape: HtmlCounterShape) => {
		// Calculate actual width: button(40) + gap(10) + counter(width) + gap(10) + button(40) + padding(20)
		const totalWidth = 40 + 10 + shape.width + 10 + 40 + 20;
		const totalHeight = shape.height + 20;
		return {
			x: shape.x,
			y: shape.y,
			width: totalWidth,
			height: totalHeight,
		};
	},
	hitTest: (shape: HtmlCounterShape, point: { x: number; y: number }) => {
		const bounds = htmlCounterPlugin.getBounds(shape);
		return (
			point.x >= bounds.x &&
			point.x <= bounds.x + bounds.width &&
			point.y >= bounds.y &&
			point.y <= bounds.y + bounds.height
		);
	},
};
