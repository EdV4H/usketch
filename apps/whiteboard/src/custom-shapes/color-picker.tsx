import type { BaseShapeConfig, Bounds } from "@usketch/shape-abstraction";
import { BaseShape } from "@usketch/shape-abstraction";
import { UnifiedShapePluginAdapter } from "@usketch/shape-registry";
import type React from "react";
import { useState } from "react";

// Define the color picker shape data structure
export interface ColorPickerShape {
	id: string;
	type: "color-picker-unified";
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	opacity: number;
	selectedColor: string;
	label: string;
}

/**
 * Interactive Color Picker Shape using unified abstraction
 * Demonstrates HTML-based interactive components with state management
 */
class ColorPicker extends BaseShape<ColorPickerShape> {
	constructor(shape: ColorPickerShape, config: BaseShapeConfig<ColorPickerShape>) {
		super(shape, {
			...config,
			renderMode: "html", // Use HTML rendering for interactive components
			enableInteractivity: true,
		});
	}

	render(): React.ReactElement {
		return <ColorPickerComponent shape={this.shape} onColorChange={this.handleColorChange} />;
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

	private handleColorChange = (color: string) => {
		// Update shape state
		this.shape.selectedColor = color;
		// Trigger re-render
		this.config.onUpdate?.(this.shape);
	};
}

// React component for the color picker
const ColorPickerComponent: React.FC<{
	shape: ColorPickerShape;
	onColorChange: (color: string) => void;
}> = ({ shape, onColorChange }) => {
	const [localColor, setLocalColor] = useState(shape.selectedColor);

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

	const handleColorSelect = (color: string, e?: React.MouseEvent) => {
		e?.stopPropagation();
		setLocalColor(color);
		onColorChange(color);
	};

	return (
		<div
			style={{
				position: "relative",
				left: 0,
				top: 0,
				width: shape.width,
				height: shape.height,
				background: "white",
				border: "2px solid #333",
				borderRadius: "8px",
				boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
				opacity: shape.opacity,
				transform: `rotate(${shape.rotation}deg)`,
				transformOrigin: "center",
				userSelect: "none",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}
		>
			{/* Draggable header */}
			<div
				style={{
					padding: "8px 12px",
					background: "linear-gradient(to bottom, #f5f5f5, #e0e0e0)",
					borderBottom: "1px solid #999",
					cursor: "move",
					fontSize: "14px",
					fontWeight: "bold",
					color: "#333",
				}}
				title="Drag here to move"
			>
				{shape.label}
			</div>

			{/* Content area */}
			<div style={{ padding: "12px", flex: 1 }}>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(5, 1fr)",
						gap: "6px",
						marginBottom: "12px",
					}}
				>
					{colors.map((color) => (
						<button
							type="button"
							key={color}
							onClick={(e) => handleColorSelect(color, e)}
							style={{
								width: "30px",
								height: "30px",
								background: color,
								border: localColor === color ? "3px solid #333" : "1px solid #ccc",
								borderRadius: "4px",
								cursor: "pointer",
								transition: "all 0.2s",
								transform: localColor === color ? "scale(1.1)" : "scale(1)",
							}}
							aria-label={`Select color ${color}`}
						/>
					))}
				</div>

				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "8px",
					}}
				>
					<div
						style={{
							width: "40px",
							height: "40px",
							background: localColor,
							border: "2px solid #333",
							borderRadius: "4px",
						}}
					/>
					<div>
						<div style={{ fontSize: "12px", color: "#666" }}>Selected:</div>
						<div style={{ fontSize: "14px", fontWeight: "bold", color: "#333" }}>{localColor}</div>
					</div>
				</div>
			</div>
			{/* Close content area */}
		</div>
	);
};

// Create the plugin using the adapter
export const colorPickerPlugin = UnifiedShapePluginAdapter.fromBaseShape(
	"color-picker-unified",
	ColorPicker as any,
	(props: { id: string; x: number; y: number; width?: number; height?: number }) =>
		({
			id: props.id,
			type: "color-picker-unified",
			x: props.x,
			y: props.y,
			width: props.width || 220,
			height: props.height || 180,
			rotation: 0,
			opacity: 1,
			selectedColor: "#FF6B6B",
			label: "Color Picker",
		}) as any,
	"Color Picker (Unified)",
) as any;
