import type { BaseShapeConfig, Bounds } from "@usketch/shape-abstraction";
import { BaseShape } from "@usketch/shape-abstraction";
import { UnifiedShapePluginAdapter } from "@usketch/shape-registry";
import React, { useState } from "react";

// Define the counter shape data structure
export interface HtmlCounterUnifiedShape {
	id: string;
	type: "html-counter-unified";
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	opacity: number;
	count: number;
	fillColor: string;
	strokeColor: string;
	strokeWidth: number;
}

// Implement using the unified BaseShape abstraction
class HtmlCounterUnified extends BaseShape<any> {
	declare shape: HtmlCounterUnifiedShape;

	constructor(shape: HtmlCounterUnifiedShape, config: BaseShapeConfig<any>) {
		super(shape, {
			...config,
			renderMode: "html", // Use HTML rendering for interactive elements
			enableInteractivity: true,
		});
	}

	render(): React.ReactElement {
		return <CounterUI shape={this.shape} onUpdate={(updates) => this.updateShape(updates)} />;
	}

	getBounds(): Bounds {
		// Include button areas in bounds
		const buttonWidth = 40;
		const gap = 10;
		const totalWidth = this.shape.width + (buttonWidth + gap) * 2;

		return {
			x: this.shape.x - buttonWidth - gap,
			y: this.shape.y,
			width: totalWidth,
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
}

// React component for the counter UI
const CounterUI: React.FC<{
	shape: HtmlCounterUnifiedShape;
	onUpdate: (updates: Partial<HtmlCounterUnifiedShape>) => void;
}> = ({ shape, onUpdate }) => {
	const [localCount, setLocalCount] = useState(shape.count);

	React.useEffect(() => {
		setLocalCount(shape.count);
	}, [shape.count]);

	const handleIncrement = () => {
		const newCount = localCount + 1;
		setLocalCount(newCount);
		onUpdate({ count: newCount });
	};

	const handleDecrement = () => {
		const newCount = localCount - 1;
		setLocalCount(newCount);
		onUpdate({ count: newCount });
	};

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: "10px",
				userSelect: "none",
				padding: "10px",
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
					boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
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
	);
};

// Create the plugin using the adapter
export const htmlCounterUnifiedPlugin = UnifiedShapePluginAdapter.fromBaseShape(
	"html-counter-unified",
	HtmlCounterUnified,
	(props: { id: string; x: number; y: number; width?: number; height?: number }) =>
		({
			id: props.id,
			type: "html-counter-unified",
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
		}) as any,
	"Unified HTML Counter",
);
