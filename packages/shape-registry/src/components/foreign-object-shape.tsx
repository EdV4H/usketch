import type { Shape } from "@usketch/shared-types";
import type React from "react";
import type { ReactNode } from "react";
import type { Bounds } from "../types";

// Helper function to check if element is interactive
const isInteractiveElement = (target: HTMLElement): boolean => {
	const interactiveTags = ["BUTTON", "INPUT", "TEXTAREA", "SELECT", "A"];
	const interactiveSelectors = ["button", "input", "textarea", "select", "a"];

	return (
		interactiveTags.includes(target.tagName) ||
		interactiveSelectors.some((selector) => target.closest(selector) !== null)
	);
};

export interface ForeignObjectShapeProps {
	shape: Shape;
	bounds: Bounds;
	isSelected?: boolean;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
	children: ReactNode;
}

/**
 * ForeignObjectShape component
 *
 * Simplified component for rendering HTML content within SVG using foreignObject.
 * This replaces the foreignObject mode of HtmlWrapper with a cleaner implementation.
 *
 * Features:
 * - Clean separation of concerns (only foreignObject, no Portal)
 * - Interactive element detection
 * - Keyboard accessibility support
 * - No mutation of external state
 */
export const ForeignObjectShape: React.FC<ForeignObjectShapeProps> = ({
	shape,
	bounds,
	isSelected = false,
	onClick,
	onPointerDown,
	onPointerMove,
	onPointerUp,
	children,
}) => {
	const handleClick = (e: React.MouseEvent) => {
		const target = e.target as HTMLElement;

		// If clicking on an interactive element, don't trigger shape selection
		if (isInteractiveElement(target)) {
			e.stopPropagation();
		} else if (onClick) {
			onClick(e);
		}
	};

	const handlePointerDown = (e: React.PointerEvent) => {
		const target = e.target as HTMLElement;

		// If clicking on an interactive element, prevent dragging
		if (isInteractiveElement(target)) {
			e.stopPropagation();
		} else if (onPointerDown) {
			onPointerDown(e);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			// Create synthetic mouse event for keyboard activation
			const syntheticEvent = {
				...e,
				button: 0,
				buttons: 1,
				clientX: 0,
				clientY: 0,
				pageX: 0,
				pageY: 0,
				screenX: 0,
				screenY: 0,
				movementX: 0,
				movementY: 0,
				getModifierState: () => false,
				relatedTarget: null,
			} as any;
			handleClick(syntheticEvent);
		}
	};

	return (
		<foreignObject
			x={bounds.x}
			y={bounds.y}
			width={bounds.width}
			height={bounds.height}
			style={{ overflow: "visible", pointerEvents: "all" }}
			data-shape-id={shape.id}
			data-shape-type={shape.type}
			data-selected={isSelected}
		>
			<div
				role="button"
				tabIndex={0}
				style={{
					width: "100%",
					height: "100%",
					position: "relative",
				}}
				onClick={handleClick}
				onPointerDown={handlePointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onKeyDown={handleKeyDown}
			>
				{children}
			</div>
		</foreignObject>
	);
};
