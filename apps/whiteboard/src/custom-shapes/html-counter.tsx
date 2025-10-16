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

// React component for the counter UI (SVG-based)
const CounterComponent: React.FC<{
	shape: HtmlCounterShape;
	isSelected?: boolean;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}> = ({ shape, isSelected, onClick, onPointerDown, onPointerMove, onPointerUp }) => {
	const buttonRadius = 20;
	const buttonGap = 10;
	const padding = 10;

	return (
		<g
			role="button"
			onClick={onClick}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			style={{ cursor: "pointer" }}
		>
			{/* Decrement Button */}
			<circle
				cx={shape.x - buttonRadius - buttonGap}
				cy={shape.y + shape.height / 2}
				r={buttonRadius}
				fill="#FF6B6B"
				stroke="#CC5555"
				strokeWidth={2}
				style={{ cursor: "pointer" }}
			/>
			<text
				x={shape.x - buttonRadius - buttonGap}
				y={shape.y + shape.height / 2}
				fill="white"
				fontSize="24"
				fontWeight="bold"
				textAnchor="middle"
				dominantBaseline="middle"
				style={{ pointerEvents: "none", userSelect: "none" }}
			>
				−
			</text>

			{/* Counter Display */}
			<rect
				x={shape.x}
				y={shape.y}
				width={shape.width}
				height={shape.height}
				rx={20}
				fill={shape.fillColor}
				stroke={shape.strokeColor}
				strokeWidth={shape.strokeWidth}
				opacity={shape.opacity}
			/>
			<text
				x={shape.x + shape.width / 2}
				y={shape.y + shape.height / 2 - 15}
				fill="#888"
				fontSize="12"
				textAnchor="middle"
				style={{ userSelect: "none" }}
			>
				COUNTER
			</text>
			<text
				x={shape.x + shape.width / 2}
				y={shape.y + shape.height / 2 + 15}
				fill="#667eea"
				fontSize="36"
				fontWeight="bold"
				textAnchor="middle"
				dominantBaseline="middle"
				style={{ userSelect: "none" }}
			>
				{shape.count}
			</text>

			{/* Increment Button */}
			<circle
				cx={shape.x + shape.width + buttonRadius + buttonGap}
				cy={shape.y + shape.height / 2}
				r={buttonRadius}
				fill="#51CF66"
				stroke="#41B856"
				strokeWidth={2}
				style={{ cursor: "pointer" }}
			/>
			<text
				x={shape.x + shape.width + buttonRadius + buttonGap}
				y={shape.y + shape.height / 2}
				fill="white"
				fontSize="24"
				fontWeight="bold"
				textAnchor="middle"
				dominantBaseline="middle"
				style={{ pointerEvents: "none", userSelect: "none" }}
			>
				+
			</text>

			{/* Selection highlight */}
			{isSelected && (
				<rect
					x={shape.x - buttonRadius - buttonGap - padding}
					y={shape.y - padding}
					width={shape.width + (buttonRadius + buttonGap + padding) * 2}
					height={shape.height + padding * 2}
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

// Wrapper component to handle interactivity
const InteractiveCounterComponent: React.FC<{
	shape: HtmlCounterShape;
	isSelected?: boolean;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}> = (props) => {
	const [localCount, setLocalCount] = useState(props.shape.count);

	React.useEffect(() => {
		setLocalCount(props.shape.count);
	}, [props.shape.count]);

	const handleClick = (e: React.MouseEvent) => {
		const buttonRadius = 20;
		const buttonGap = 10;
		const svgElement = (e.target as SVGElement).ownerSVGElement;
		if (!svgElement) return;

		const point = svgElement.createSVGPoint();
		point.x = e.clientX;
		point.y = e.clientY;
		const svgPoint = point.matrixTransform(svgElement.getScreenCTM()?.inverse());

		// Check if clicked on decrement button
		const decrementX = props.shape.x - buttonRadius - buttonGap;
		const decrementY = props.shape.y + props.shape.height / 2;
		const decrementDist = Math.sqrt(
			(svgPoint.x - decrementX) ** 2 + (svgPoint.y - decrementY) ** 2,
		);

		if (decrementDist <= buttonRadius) {
			setLocalCount((prev) => prev - 1);
			e.stopPropagation();
			return;
		}

		// Check if clicked on increment button
		const incrementX = props.shape.x + props.shape.width + buttonRadius + buttonGap;
		const incrementY = props.shape.y + props.shape.height / 2;
		const incrementDist = Math.sqrt(
			(svgPoint.x - incrementX) ** 2 + (svgPoint.y - incrementY) ** 2,
		);

		if (incrementDist <= buttonRadius) {
			setLocalCount((prev) => prev + 1);
			e.stopPropagation();
			return;
		}

		// Otherwise, pass through to default handler
		if (props.onClick) {
			props.onClick(e);
		}
	};

	return (
		<CounterComponent
			{...props}
			shape={{ ...props.shape, count: localCount }}
			onClick={handleClick}
		/>
	);
};

export const htmlCounterPlugin: ShapePlugin<HtmlCounterShape> = {
	type: "html-counter",
	component: InteractiveCounterComponent,
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
		const buttonRadius = 20;
		const buttonGap = 10;
		const padding = 10;
		return {
			x: shape.x - buttonRadius - buttonGap - padding,
			y: shape.y - padding,
			width: shape.width + (buttonRadius + buttonGap + padding) * 2,
			height: shape.height + padding * 2,
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
