import type React from "react";
import type { ShapeRenderer } from "../types";
import { HtmlWrapper } from "./HtmlWrapper";

export interface HybridWrapperProps {
	renderer: ShapeRenderer;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}

export const HybridWrapper: React.FC<HybridWrapperProps> = (props) => {
	// For hybrid mode, we always render as HTML which can contain both SVG and HTML elements
	// The shape component itself is responsible for mixing SVG and HTML content
	return <HtmlWrapper {...props} />;
};
