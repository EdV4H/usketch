import type { ShapeData } from "@edv4h/usketch-shared";
import type { ReactElement } from "react";
import { createDefaultArrow } from "./shapes/arrow.js";
import { createDefaultDiamond } from "./shapes/diamond.js";
import { createDefaultEllipse } from "./shapes/ellipse.js";
import { createDefaultLine } from "./shapes/line.js";
import { createDefaultRectangle } from "./shapes/rectangle.js";
import { createDefaultRoundedRect } from "./shapes/rounded-rect.js";
import { createDefaultStar } from "./shapes/star.js";
import { createDefaultTriangle } from "./shapes/triangle.js";

export interface BasicShapeSubtype {
	type: string;
	label: string;
	icon: () => ReactElement;
	createDefault: (params: { id: string; x: number; y: number }) => ShapeData;
	defaultSize: { width: number; height: number };
}

function RectIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<rect
				x="2"
				y="3"
				width="12"
				height="10"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
			/>
		</svg>
	);
}

function RoundedRectIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<rect
				x="2"
				y="3"
				width="12"
				height="10"
				rx="3"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
			/>
		</svg>
	);
}

function EllipseIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<ellipse cx="8" cy="8" rx="6" ry="5" fill="none" stroke="currentColor" strokeWidth="1.2" />
		</svg>
	);
}

function TriangleIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<polygon points="8,2 2,14 14,14" fill="none" stroke="currentColor" strokeWidth="1.2" />
		</svg>
	);
}

function DiamondIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<polygon points="8,1 15,8 8,15 1,8" fill="none" stroke="currentColor" strokeWidth="1.2" />
		</svg>
	);
}

function StarIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<polygon
				points="8,1 9.8,5.8 15,6.2 11.2,9.6 12.4,15 8,12 3.6,15 4.8,9.6 1,6.2 6.2,5.8"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
			/>
		</svg>
	);
}

function ArrowIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<polygon
				points="1,5 9,5 9,2 15,8 9,14 9,11 1,11"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
			/>
		</svg>
	);
}

function LineIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<line
				x1="2"
				y1="14"
				x2="14"
				y2="2"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</svg>
	);
}

export const BASIC_SHAPE_SUBTYPES: BasicShapeSubtype[] = [
	{
		type: "rectangle",
		label: "Rectangle",
		icon: RectIcon,
		createDefault: createDefaultRectangle,
		defaultSize: { width: 100, height: 80 },
	},
	{
		type: "rounded-rect",
		label: "Rounded",
		icon: RoundedRectIcon,
		createDefault: createDefaultRoundedRect,
		defaultSize: { width: 100, height: 80 },
	},
	{
		type: "ellipse",
		label: "Ellipse",
		icon: EllipseIcon,
		createDefault: createDefaultEllipse,
		defaultSize: { width: 100, height: 80 },
	},
	{
		type: "triangle",
		label: "Triangle",
		icon: TriangleIcon,
		createDefault: createDefaultTriangle,
		defaultSize: { width: 100, height: 90 },
	},
	{
		type: "diamond",
		label: "Diamond",
		icon: DiamondIcon,
		createDefault: createDefaultDiamond,
		defaultSize: { width: 100, height: 100 },
	},
	{
		type: "star",
		label: "Star",
		icon: StarIcon,
		createDefault: createDefaultStar,
		defaultSize: { width: 100, height: 100 },
	},
	{
		type: "arrow",
		label: "Arrow",
		icon: ArrowIcon,
		createDefault: createDefaultArrow,
		defaultSize: { width: 120, height: 60 },
	},
	{
		type: "line",
		label: "Line",
		icon: LineIcon,
		createDefault: createDefaultLine,
		defaultSize: { width: 100, height: 4 },
	},
];
