import type { ShapeData } from "@edv4h/usketch-shared";
import type { ReactElement } from "react";
import { createDefaultButton } from "../shapes/wireframe-button.js";
import { createDefaultCard } from "../shapes/wireframe-card.js";
import { createDefaultCheckbox } from "../shapes/wireframe-checkbox.js";
import { createDefaultContainer } from "../shapes/wireframe-container.js";
import { createDefaultInput } from "../shapes/wireframe-input.js";
import { createDefaultSelect } from "../shapes/wireframe-select.js";

export interface WireframeSubtype {
	type: string;
	label: string;
	icon: () => ReactElement;
	createDefault: (params: { id: string; x: number; y: number }) => ShapeData;
	defaultSize: { width: number; height: number };
}

function ButtonIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<rect
				x="1"
				y="4"
				width="14"
				height="8"
				rx="3"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
			/>
			<line
				x1="5"
				y1="8"
				x2="11"
				y2="8"
				stroke="currentColor"
				strokeWidth="1.2"
				strokeLinecap="round"
			/>
		</svg>
	);
}

function InputIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<rect
				x="1"
				y="4"
				width="14"
				height="8"
				rx="2"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
			/>
			<line x1="4" y1="6.5" x2="4" y2="9.5" stroke="currentColor" strokeWidth="1" />
		</svg>
	);
}

function SelectIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<rect
				x="1"
				y="4"
				width="14"
				height="8"
				rx="2"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
			/>
			<path
				d="M10 7l2 2 2-2"
				fill="none"
				stroke="currentColor"
				strokeWidth="1"
				strokeLinecap="round"
			/>
		</svg>
	);
}

function CheckboxIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<rect
				x="2"
				y="3"
				width="10"
				height="10"
				rx="2"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
			/>
			<path
				d="M5 8l2 2 3-4"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function CardIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<rect
				x="1"
				y="2"
				width="14"
				height="12"
				rx="2"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
			/>
			<line x1="1" y1="6" x2="15" y2="6" stroke="currentColor" strokeWidth="1" />
		</svg>
	);
}

function ContainerIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<rect
				x="1"
				y="2"
				width="14"
				height="12"
				rx="2"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
				strokeDasharray="3 2"
			/>
			<line x1="3" y1="5" x2="8" y2="5" stroke="currentColor" strokeWidth="1" />
		</svg>
	);
}

export const WIREFRAME_SUBTYPES: WireframeSubtype[] = [
	{
		type: "wireframe-button",
		label: "Button",
		icon: ButtonIcon,
		createDefault: createDefaultButton,
		defaultSize: { width: 120, height: 40 },
	},
	{
		type: "wireframe-input",
		label: "Input",
		icon: InputIcon,
		createDefault: createDefaultInput,
		defaultSize: { width: 240, height: 56 },
	},
	{
		type: "wireframe-select",
		label: "Select",
		icon: SelectIcon,
		createDefault: createDefaultSelect,
		defaultSize: { width: 240, height: 40 },
	},
	{
		type: "wireframe-checkbox",
		label: "Checkbox",
		icon: CheckboxIcon,
		createDefault: createDefaultCheckbox,
		defaultSize: { width: 160, height: 24 },
	},
	{
		type: "wireframe-card",
		label: "Card",
		icon: CardIcon,
		createDefault: createDefaultCard,
		defaultSize: { width: 280, height: 200 },
	},
	{
		type: "wireframe-container",
		label: "Container",
		icon: ContainerIcon,
		createDefault: createDefaultContainer,
		defaultSize: { width: 400, height: 300 },
	},
];
