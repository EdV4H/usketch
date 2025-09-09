import type { Camera, Shape } from "@usketch/shared-types";
import type React from "react";
import { useMemo } from "react";
import { ShapeFactory } from "../ShapeFactory";
import { HtmlWrapper } from "./HtmlWrapper";
import { HybridWrapper } from "./HybridWrapper";
import { SvgWrapper } from "./SvgWrapper";

export interface UnifiedShapeRendererProps {
	shape: Shape;
	isSelected: boolean;
	camera: Camera;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}

export const UnifiedShapeRenderer: React.FC<UnifiedShapeRendererProps> = ({
	shape,
	isSelected,
	camera,
	onClick,
	onPointerDown,
	onPointerMove,
	onPointerUp,
}) => {
	const renderer = useMemo(() => {
		try {
			return ShapeFactory.create(shape);
		} catch (error) {
			// Failed to create renderer for shape type
			return null;
		}
	}, [shape.type, shape.id, shape]);

	if (!renderer) {
		return null;
	}

	// Update renderer state
	renderer.camera = camera;
	renderer.isSelected = isSelected;
	renderer.shape = shape;

	const renderMode = renderer.getRenderMode();

	const wrapperProps = {
		renderer,
		onClick,
		onPointerDown,
		onPointerMove,
		onPointerUp,
	};

	switch (renderMode) {
		case "html":
			return <HtmlWrapper {...wrapperProps} />;
		case "hybrid":
			return <HybridWrapper {...wrapperProps} />;
		default:
			return <SvgWrapper {...wrapperProps} />;
	}
};
