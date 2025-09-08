import type React from "react";
import { useState } from "react";
import type { ShapeRenderer } from "../types";
import { HtmlWrapper } from "./HtmlWrapper";
import { SvgWrapper } from "./SvgWrapper";

export interface HybridWrapperProps {
	renderer: ShapeRenderer;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}

export const HybridWrapper: React.FC<HybridWrapperProps> = (props) => {
	const { renderer } = props;
	const [isInteracting, setIsInteracting] = useState(false);
	const [isHovering, setIsHovering] = useState(false);

	// Determine when to use HTML mode
	const useHtmlMode = isInteracting || isHovering || renderer.isSelected;

	const enhancedProps = {
		...props,
		onPointerDown: (e: React.PointerEvent) => {
			setIsInteracting(true);
			props.onPointerDown?.(e);
		},
		onPointerUp: (e: React.PointerEvent) => {
			setIsInteracting(false);
			props.onPointerUp?.(e);
		},
		onPointerEnter: () => {
			setIsHovering(true);
		},
		onPointerLeave: () => {
			setIsHovering(false);
		},
	};

	// Switch between SVG and HTML based on interaction state
	if (useHtmlMode && renderer.isInteractive()) {
		return <HtmlWrapper {...enhancedProps} />;
	}

	return <SvgWrapper {...enhancedProps} />;
};
