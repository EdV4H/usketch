import type { Bounds, RectangleShape } from "@usketch/shared-types";
import type React from "react";
import { BaseShape } from "../BaseShape";
import type { BaseShapeConfig } from "../types";

// Implement a simple rectangle shape using BaseShape
export class SimpleRectangle extends BaseShape<RectangleShape> {
	constructor(shape: RectangleShape, config: BaseShapeConfig<RectangleShape>) {
		super(shape, {
			...config,
			renderMode: "svg", // Use SVG for simple shapes
		});
	}

	render(): React.ReactElement {
		const { x, y, width, height, fillColor, strokeColor, strokeWidth, opacity, rotation } =
			this.shape;

		const transform = rotation
			? `rotate(${rotation} ${x + width / 2} ${y + height / 2})`
			: undefined;

		return (
			<g transform={transform} opacity={opacity}>
				<rect
					x={x}
					y={y}
					width={width}
					height={height}
					fill={fillColor}
					stroke={strokeColor}
					strokeWidth={strokeWidth}
					style={{
						transition: "all 0.2s ease",
						...this.getSelectionStyle(),
					}}
				/>
				{this.isSelected && (
					<rect
						x={x - 2}
						y={y - 2}
						width={width + 4}
						height={height + 4}
						fill="none"
						stroke="#0066FF"
						strokeWidth={2}
						strokeDasharray="5,5"
						pointerEvents="none"
					/>
				)}
			</g>
		);
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
		const { x, y, width, height } = this.shape;
		return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
	}

	// Override resize to handle all handles
	onResize(handle: any, delta: { x: number; y: number }): void {
		const updates: Partial<RectangleShape> = {};

		switch (handle) {
			case "top-left":
				updates.x = this.shape.x + delta.x;
				updates.y = this.shape.y + delta.y;
				updates.width = this.shape.width - delta.x;
				updates.height = this.shape.height - delta.y;
				break;
			case "top":
				updates.y = this.shape.y + delta.y;
				updates.height = this.shape.height - delta.y;
				break;
			case "top-right":
				updates.y = this.shape.y + delta.y;
				updates.width = this.shape.width + delta.x;
				updates.height = this.shape.height - delta.y;
				break;
			case "right":
				updates.width = this.shape.width + delta.x;
				break;
			case "bottom-right":
				updates.width = this.shape.width + delta.x;
				updates.height = this.shape.height + delta.y;
				break;
			case "bottom":
				updates.height = this.shape.height + delta.y;
				break;
			case "bottom-left":
				updates.x = this.shape.x + delta.x;
				updates.width = this.shape.width - delta.x;
				updates.height = this.shape.height + delta.y;
				break;
			case "left":
				updates.x = this.shape.x + delta.x;
				updates.width = this.shape.width - delta.x;
				break;
		}

		// Ensure minimum size
		if (updates.width !== undefined && updates.width < 20) {
			updates.width = 20;
		}
		if (updates.height !== undefined && updates.height < 20) {
			updates.height = 20;
		}

		this.updateShape(updates);
	}
}
