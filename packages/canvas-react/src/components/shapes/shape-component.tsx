import type { Shape } from "@usketch/shared-types";
import type React from "react";
import { EllipseShape } from "./ellipse-shape";
import { FreedrawShape } from "./freedraw-shape";
import { RectangleShape } from "./rectangle-shape";

interface ShapeComponentProps {
	shape: Shape;
}

export const ShapeComponent: React.FC<ShapeComponentProps> = ({ shape }) => {
	switch (shape.type) {
		case "rectangle":
			return <RectangleShape shape={shape} />;
		case "ellipse":
			return <EllipseShape shape={shape} />;
		case "freedraw":
			return <FreedrawShape shape={shape} />;
		default:
			return null;
	}
};
