import { Ellipse, Freedraw, Rectangle } from "@usketch/react-shapes";
import type { Shape as ShapeType } from "@usketch/shared-types";
import React from "react";

interface ShapeProps {
	shape: ShapeType;
	isSelected?: boolean;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}

export const Shape: React.FC<ShapeProps> = React.memo(
	({ shape, isSelected = false, onClick, onPointerDown, onPointerMove, onPointerUp }) => {
		switch (shape.type) {
			case "rectangle":
				return (
					<Rectangle
						shape={shape}
						isSelected={isSelected}
						onClick={onClick}
						onPointerDown={onPointerDown}
						onPointerMove={onPointerMove}
						onPointerUp={onPointerUp}
					/>
				);
			case "ellipse":
				return (
					<Ellipse
						shape={shape}
						isSelected={isSelected}
						onClick={onClick}
						onPointerDown={onPointerDown}
						onPointerMove={onPointerMove}
						onPointerUp={onPointerUp}
					/>
				);
			case "freedraw":
				return (
					<Freedraw
						shape={shape}
						isSelected={isSelected}
						onClick={onClick}
						onPointerDown={onPointerDown}
						onPointerMove={onPointerMove}
						onPointerUp={onPointerUp}
					/>
				);
			default:
				return null;
		}
	},
);
