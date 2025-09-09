import type { Bounds } from "@usketch/shared-types";
import React, { useState } from "react";
import { BaseShape } from "../BaseShape";
import type { BaseShapeConfig } from "../types";

// Define the counter shape data structure
export interface CounterShapeData {
	id: string;
	type: "counter";
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

// Implement the counter shape using BaseShape
export class CounterShape extends BaseShape<any> {
	declare shape: CounterShapeData;

	constructor(shape: CounterShapeData, config: BaseShapeConfig<any>) {
		super(shape, {
			...config,
			renderMode: "hybrid", // Use hybrid mode for optimal performance
			enableInteractivity: true,
		});
	}

	render(): React.ReactElement {
		return (
			<CounterComponent shape={this.shape} onUpdate={(updates) => this.updateShape(updates)} />
		);
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
const CounterComponent: React.FC<{
	shape: CounterShapeData;
	onUpdate: (updates: Partial<CounterShapeData>) => void;
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
					borderRadius: "12px",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					fontSize: "16px",
					fontWeight: "600",
				}}
			>
				<div style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}>Counter</div>
				<div style={{ fontSize: "32px", fontWeight: "bold", color: "#333" }}>{localCount}</div>
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
				}}
			>
				+
			</button>
		</div>
	);
};

// Factory function for creating counter shapes
export const createCounterShape = (props: {
	id: string;
	x: number;
	y: number;
	width?: number;
	height?: number;
}): CounterShapeData => ({
	id: props.id,
	type: "counter" as const,
	x: props.x,
	y: props.y,
	width: props.width || 120,
	height: props.height || 80,
	rotation: 0,
	opacity: 1,
	fillColor: "#FFFFFF",
	strokeColor: "#333333",
	strokeWidth: 2,
	count: 0,
});
