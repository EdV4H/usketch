import React from "react";
import type { ShapeRenderer } from "../types";

export interface SvgWrapperProps {
	renderer: ShapeRenderer;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}

export const SvgWrapper: React.FC<SvgWrapperProps> = ({
	renderer,
	onClick,
	onPointerDown,
	onPointerMove,
	onPointerUp,
}) => {
	const handlePointerDown = (e: React.PointerEvent) => {
		if (renderer.onPointerDown) {
			renderer.onPointerDown(e);
		}
		if (onPointerDown) {
			onPointerDown(e);
		}
	};

	const handlePointerMove = (e: React.PointerEvent) => {
		if (renderer.onPointerMove) {
			renderer.onPointerMove(e);
		}
		if (onPointerMove) {
			onPointerMove(e);
		}
	};

	const handlePointerUp = (e: React.PointerEvent) => {
		if (renderer.onPointerUp) {
			renderer.onPointerUp(e);
		}
		if (onPointerUp) {
			onPointerUp(e);
		}
	};

	const handleClick = (e: React.MouseEvent) => {
		if (onClick) {
			onClick(e);
		}
	};

	// Render the shape element from the renderer
	const shapeElement = renderer.render();

	// If the element is already an SVG element, return it with event handlers
	if (React.isValidElement(shapeElement)) {
		return React.cloneElement(shapeElement as React.ReactElement<any>, {
			onClick: handleClick,
			onPointerDown: handlePointerDown,
			onPointerMove: handlePointerMove,
			onPointerUp: handlePointerUp,
			"data-shape-id": renderer.shape.id,
			"data-shape-type": renderer.shape.type,
		});
	}

	// Fallback: wrap in a group element
	return (
		<g
			data-shape-id={renderer.shape.id}
			data-shape-type={renderer.shape.type}
			onClick={handleClick}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
		>
			{shapeElement}
		</g>
	);
};
