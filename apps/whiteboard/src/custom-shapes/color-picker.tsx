import type { ShapePlugin } from "@usketch/shape-registry";
import type React from "react";
import { useId, useState } from "react";

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

// Define the color picker shape data structure
export interface ColorPickerShape extends CustomBaseShape {
	type: "color-picker";
	selectedColor: string;
	label: string;
}

// React component for the color picker (SVG-based)
const ColorPickerComponent: React.FC<{
	shape: ColorPickerShape;
	isSelected?: boolean;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}> = ({ shape, isSelected, onClick, onPointerDown, onPointerMove, onPointerUp }) => {
	const [localColor, setLocalColor] = useState(shape.selectedColor);
	const gradientId = useId();

	const colors = [
		"#FF6B6B", // Red
		"#4ECDC4", // Teal
		"#45B7D1", // Blue
		"#96CEB4", // Green
		"#FFEAA7", // Yellow
		"#DDA0DD", // Plum
		"#98D8C8", // Mint
		"#FFB6C1", // Pink
		"#87CEEB", // Sky Blue
		"#F4A460", // Sandy Brown
	];

	const handleColorSelect = (color: string, e: React.MouseEvent) => {
		e.stopPropagation();
		setLocalColor(color);
	};

	const headerHeight = 30;
	const padding = 12;
	const colorSize = 30;
	const colorGap = 6;
	const colorsPerRow = 5;

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

			{/* Header */}
			<rect
				x={shape.x}
				y={shape.y}
				width={shape.width}
				height={headerHeight}
				fill={`url(#${gradientId})`}
				stroke="#999"
				strokeWidth={1}
				rx={8}
			/>
			<defs>
				<linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
					<stop offset="0%" stopColor="#f5f5f5" />
					<stop offset="100%" stopColor="#e0e0e0" />
				</linearGradient>
			</defs>
			<text
				x={shape.x + shape.width / 2}
				y={shape.y + headerHeight / 2}
				fill="#333"
				fontSize="14"
				fontWeight="bold"
				textAnchor="middle"
				dominantBaseline="middle"
				style={{ userSelect: "none" }}
			>
				{shape.label}
			</text>

			{/* Color grid */}
			{colors.map((color, index) => {
				const row = Math.floor(index / colorsPerRow);
				const col = index % colorsPerRow;
				const x = shape.x + padding + col * (colorSize + colorGap);
				const y = shape.y + headerHeight + padding + row * (colorSize + colorGap);
				const isSelected = localColor === color;

				return (
					<g key={color}>
						<rect
							role="button"
							x={x}
							y={y}
							width={colorSize}
							height={colorSize}
							fill={color}
							stroke={isSelected ? "#333" : "#ccc"}
							strokeWidth={isSelected ? 3 : 1}
							rx={4}
							style={{ cursor: "pointer" }}
							onClick={(e) => handleColorSelect(color, e)}
						/>
					</g>
				);
			})}

			{/* Selected color display */}
			<rect
				x={shape.x + padding}
				y={shape.y + headerHeight + padding + 2 * (colorSize + colorGap) + 12}
				width={40}
				height={40}
				fill={localColor}
				stroke="#333"
				strokeWidth={2}
				rx={4}
			/>
			<text
				x={shape.x + padding + 50}
				y={shape.y + headerHeight + padding + 2 * (colorSize + colorGap) + 22}
				fill="#666"
				fontSize="12"
				style={{ userSelect: "none" }}
			>
				Selected:
			</text>
			<text
				x={shape.x + padding + 50}
				y={shape.y + headerHeight + padding + 2 * (colorSize + colorGap) + 38}
				fill="#333"
				fontSize="14"
				fontWeight="bold"
				style={{ userSelect: "none" }}
			>
				{localColor}
			</text>

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

export const colorPickerPlugin: ShapePlugin<ColorPickerShape> = {
	type: "color-picker",
	component: ColorPickerComponent,
	createDefaultShape: (props: {
		id: string;
		x: number;
		y: number;
		width?: number;
		height?: number;
	}) => ({
		id: props.id,
		type: "color-picker" as const,
		x: props.x,
		y: props.y,
		width: props.width || 220,
		height: props.height || 180,
		rotation: 0,
		opacity: 1,
		strokeColor: "#333333",
		fillColor: "#FFFFFF",
		strokeWidth: 2,
		selectedColor: "#FF6B6B",
		label: "Color Picker",
	}),
	getBounds: (shape: ColorPickerShape) => ({
		x: shape.x,
		y: shape.y,
		width: shape.width,
		height: shape.height,
	}),
	hitTest: (shape: ColorPickerShape, point: { x: number; y: number }) => {
		return (
			point.x >= shape.x &&
			point.x <= shape.x + shape.width &&
			point.y >= shape.y &&
			point.y <= shape.y + shape.height
		);
	},
};
