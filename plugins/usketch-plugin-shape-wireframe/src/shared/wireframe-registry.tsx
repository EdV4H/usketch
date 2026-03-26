import type { ShapeData } from "@edv4h/usketch-shared";
import type { ReactElement } from "react";
import { createDefaultAccordion } from "../shapes/wireframe-accordion.js";
import { createDefaultAlert } from "../shapes/wireframe-alert.js";
import { createDefaultAvatar } from "../shapes/wireframe-avatar.js";
import { createDefaultBadge } from "../shapes/wireframe-badge.js";
import { createDefaultBreadcrumb } from "../shapes/wireframe-breadcrumb.js";
import { createDefaultButton } from "../shapes/wireframe-button.js";
import { createDefaultCard } from "../shapes/wireframe-card.js";
import { createDefaultCheckbox } from "../shapes/wireframe-checkbox.js";
import { createDefaultContainer } from "../shapes/wireframe-container.js";
import { createDefaultDivider } from "../shapes/wireframe-divider.js";
import { createDefaultImage } from "../shapes/wireframe-image.js";
import { createDefaultInput } from "../shapes/wireframe-input.js";
import { createDefaultList } from "../shapes/wireframe-list.js";
import { createDefaultModal } from "../shapes/wireframe-modal.js";
import { createDefaultNavbar } from "../shapes/wireframe-navbar.js";
import { createDefaultProgress } from "../shapes/wireframe-progress.js";
import { createDefaultSelect } from "../shapes/wireframe-select.js";
import { createDefaultSidebar } from "../shapes/wireframe-sidebar.js";
import { createDefaultTable } from "../shapes/wireframe-table.js";
import { createDefaultTabs } from "../shapes/wireframe-tabs.js";
import { createDefaultToast } from "../shapes/wireframe-toast.js";

export interface WireframeSubtype {
	type: string;
	label: string;
	category: string;
	icon: () => ReactElement;
	createDefault: (params: { id: string; x: number; y: number }) => ShapeData;
	defaultSize: { width: number; height: number };
}

// ── Icons ──

function IconBtn() {
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
function IconInput() {
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
function IconSelect() {
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
function IconCheck() {
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
function IconCard() {
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
function IconContainer() {
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
function IconNavbar() {
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
			<circle cx="4" cy="8" r="1.5" fill="currentColor" opacity="0.4" />
			<line
				x1="7"
				y1="8"
				x2="13"
				y2="8"
				stroke="currentColor"
				strokeWidth="1"
				strokeLinecap="round"
			/>
		</svg>
	);
}
function IconTabs() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<line x1="1" y1="12" x2="15" y2="12" stroke="currentColor" strokeWidth="1.2" />
			<rect x="1" y="6" width="4" height="6" fill="none" stroke="currentColor" strokeWidth="1" />
			<rect
				x="6"
				y="6"
				width="4"
				height="6"
				fill="currentColor"
				opacity="0.15"
				stroke="currentColor"
				strokeWidth="1"
			/>
			<rect x="11" y="6" width="4" height="6" fill="none" stroke="currentColor" strokeWidth="1" />
		</svg>
	);
}
function IconBreadcrumb() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<circle cx="3" cy="8" r="1.5" fill="currentColor" opacity="0.3" />
			<line x1="5.5" y1="8" x2="7" y2="8" stroke="currentColor" strokeWidth="1" />
			<circle cx="9" cy="8" r="1.5" fill="currentColor" opacity="0.3" />
			<line x1="11.5" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1" />
		</svg>
	);
}
function IconSidebar() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<rect
				x="1"
				y="2"
				width="5"
				height="12"
				rx="1"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
			/>
			<line x1="3" y1="5" x2="4.5" y2="5" stroke="currentColor" strokeWidth="1" />
			<line x1="3" y1="7.5" x2="4.5" y2="7.5" stroke="currentColor" strokeWidth="1" />
			<line x1="3" y1="10" x2="4.5" y2="10" stroke="currentColor" strokeWidth="1" />
			<rect
				x="7"
				y="2"
				width="8"
				height="12"
				rx="1"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
				strokeDasharray="2 2"
			/>
		</svg>
	);
}
function IconAvatar() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.2" />
			<circle cx="8" cy="6.5" r="2" fill="currentColor" opacity="0.3" />
			<path d="M4 13a4 4 0 018 0" fill="currentColor" opacity="0.2" />
		</svg>
	);
}
function IconImage() {
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
			<circle cx="5" cy="6" r="1.5" fill="currentColor" opacity="0.3" />
			<path
				d="M1 11l4-3 3 2 3-3 4 4v1a2 2 0 01-2 2H3a2 2 0 01-2-2z"
				fill="currentColor"
				opacity="0.15"
			/>
		</svg>
	);
}
function IconBadge() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<rect
				x="2"
				y="5"
				width="12"
				height="6"
				rx="3"
				fill="currentColor"
				opacity="0.2"
				stroke="currentColor"
				strokeWidth="1"
			/>
		</svg>
	);
}
function IconTable() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<rect
				x="1"
				y="2"
				width="14"
				height="12"
				rx="1"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
			/>
			<line x1="1" y1="6" x2="15" y2="6" stroke="currentColor" strokeWidth="1" />
			<line x1="1" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="1" />
			<line x1="6" y1="2" x2="6" y2="14" stroke="currentColor" strokeWidth="1" />
			<line x1="11" y1="2" x2="11" y2="14" stroke="currentColor" strokeWidth="1" />
		</svg>
	);
}
function IconList() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<circle cx="3" cy="4.5" r="1" fill="currentColor" />
			<line
				x1="6"
				y1="4.5"
				x2="14"
				y2="4.5"
				stroke="currentColor"
				strokeWidth="1.2"
				strokeLinecap="round"
			/>
			<circle cx="3" cy="8" r="1" fill="currentColor" />
			<line
				x1="6"
				y1="8"
				x2="14"
				y2="8"
				stroke="currentColor"
				strokeWidth="1.2"
				strokeLinecap="round"
			/>
			<circle cx="3" cy="11.5" r="1" fill="currentColor" />
			<line
				x1="6"
				y1="11.5"
				x2="14"
				y2="11.5"
				stroke="currentColor"
				strokeWidth="1.2"
				strokeLinecap="round"
			/>
		</svg>
	);
}
function IconAlert() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<rect
				x="1"
				y="4"
				width="14"
				height="8"
				rx="2"
				fill="currentColor"
				opacity="0.1"
				stroke="currentColor"
				strokeWidth="1.2"
			/>
			<line x1="3" y1="4" x2="3" y2="12" stroke="currentColor" strokeWidth="2" />
			<circle cx="8" cy="8" r="1" fill="currentColor" />
		</svg>
	);
}
function IconModal() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<rect
				x="2"
				y="3"
				width="12"
				height="10"
				rx="2"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
			/>
			<line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1" />
			<line x1="11" y1="4" x2="13" y2="5.5" stroke="currentColor" strokeWidth="1" />
			<line x1="13" y1="4" x2="11" y2="5.5" stroke="currentColor" strokeWidth="1" />
		</svg>
	);
}
function IconToast() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<rect
				x="1"
				y="5"
				width="14"
				height="6"
				rx="3"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
			/>
			<circle cx="5" cy="8" r="1.5" fill="currentColor" opacity="0.3" />
			<line
				x1="8"
				y1="8"
				x2="12"
				y2="8"
				stroke="currentColor"
				strokeWidth="1"
				strokeLinecap="round"
			/>
		</svg>
	);
}
function IconProgress() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<rect
				x="1"
				y="6"
				width="14"
				height="4"
				rx="2"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
			/>
			<rect x="1" y="6" width="9" height="4" rx="2" fill="currentColor" opacity="0.3" />
		</svg>
	);
}
function IconDivider() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<line
				x1="1"
				y1="8"
				x2="15"
				y2="8"
				stroke="currentColor"
				strokeWidth="1.2"
				strokeLinecap="round"
			/>
		</svg>
	);
}
function IconAccordion() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<rect
				x="1"
				y="2"
				width="14"
				height="4"
				rx="1"
				fill="none"
				stroke="currentColor"
				strokeWidth="1"
			/>
			<path d="M12 3.5l-1 1 1 1" fill="none" stroke="currentColor" strokeWidth="0.8" />
			<rect
				x="1"
				y="7"
				width="14"
				height="4"
				rx="1"
				fill="currentColor"
				opacity="0.1"
				stroke="currentColor"
				strokeWidth="1"
			/>
			<path d="M11.5 8.5l1 1 -1 1" fill="none" stroke="currentColor" strokeWidth="0.8" />
			<rect
				x="1"
				y="12"
				width="14"
				height="3"
				rx="1"
				fill="none"
				stroke="currentColor"
				strokeWidth="1"
			/>
		</svg>
	);
}

// ── Registry ──

export const WIREFRAME_SUBTYPES: WireframeSubtype[] = [
	// Form
	{
		type: "wireframe-button",
		label: "Button",
		category: "Form",
		icon: IconBtn,
		createDefault: createDefaultButton,
		defaultSize: { width: 120, height: 40 },
	},
	{
		type: "wireframe-input",
		label: "Input",
		category: "Form",
		icon: IconInput,
		createDefault: createDefaultInput,
		defaultSize: { width: 240, height: 56 },
	},
	{
		type: "wireframe-select",
		label: "Select",
		category: "Form",
		icon: IconSelect,
		createDefault: createDefaultSelect,
		defaultSize: { width: 240, height: 40 },
	},
	{
		type: "wireframe-checkbox",
		label: "Checkbox",
		category: "Form",
		icon: IconCheck,
		createDefault: createDefaultCheckbox,
		defaultSize: { width: 160, height: 24 },
	},
	// Navigation
	{
		type: "wireframe-navbar",
		label: "Navbar",
		category: "Nav",
		icon: IconNavbar,
		createDefault: createDefaultNavbar,
		defaultSize: { width: 600, height: 48 },
	},
	{
		type: "wireframe-tabs",
		label: "Tabs",
		category: "Nav",
		icon: IconTabs,
		createDefault: createDefaultTabs,
		defaultSize: { width: 320, height: 40 },
	},
	{
		type: "wireframe-breadcrumb",
		label: "Breadcrumb",
		category: "Nav",
		icon: IconBreadcrumb,
		createDefault: createDefaultBreadcrumb,
		defaultSize: { width: 240, height: 24 },
	},
	{
		type: "wireframe-sidebar",
		label: "Sidebar",
		category: "Nav",
		icon: IconSidebar,
		createDefault: createDefaultSidebar,
		defaultSize: { width: 200, height: 300 },
	},
	// Content
	{
		type: "wireframe-card",
		label: "Card",
		category: "Content",
		icon: IconCard,
		createDefault: createDefaultCard,
		defaultSize: { width: 280, height: 200 },
	},
	{
		type: "wireframe-avatar",
		label: "Avatar",
		category: "Content",
		icon: IconAvatar,
		createDefault: createDefaultAvatar,
		defaultSize: { width: 40, height: 40 },
	},
	{
		type: "wireframe-image",
		label: "Image",
		category: "Content",
		icon: IconImage,
		createDefault: createDefaultImage,
		defaultSize: { width: 240, height: 160 },
	},
	{
		type: "wireframe-badge",
		label: "Badge",
		category: "Content",
		icon: IconBadge,
		createDefault: createDefaultBadge,
		defaultSize: { width: 64, height: 24 },
	},
	{
		type: "wireframe-table",
		label: "Table",
		category: "Content",
		icon: IconTable,
		createDefault: createDefaultTable,
		defaultSize: { width: 400, height: 180 },
	},
	{
		type: "wireframe-list",
		label: "List",
		category: "Content",
		icon: IconList,
		createDefault: createDefaultList,
		defaultSize: { width: 200, height: 120 },
	},
	// Feedback
	{
		type: "wireframe-alert",
		label: "Alert",
		category: "Feedback",
		icon: IconAlert,
		createDefault: createDefaultAlert,
		defaultSize: { width: 320, height: 48 },
	},
	{
		type: "wireframe-modal",
		label: "Modal",
		category: "Feedback",
		icon: IconModal,
		createDefault: createDefaultModal,
		defaultSize: { width: 360, height: 220 },
	},
	{
		type: "wireframe-toast",
		label: "Toast",
		category: "Feedback",
		icon: IconToast,
		createDefault: createDefaultToast,
		defaultSize: { width: 300, height: 48 },
	},
	{
		type: "wireframe-progress",
		label: "Progress",
		category: "Feedback",
		icon: IconProgress,
		createDefault: createDefaultProgress,
		defaultSize: { width: 200, height: 24 },
	},
	// Layout
	{
		type: "wireframe-container",
		label: "Container",
		category: "Layout",
		icon: IconContainer,
		createDefault: createDefaultContainer,
		defaultSize: { width: 400, height: 300 },
	},
	{
		type: "wireframe-divider",
		label: "Divider",
		category: "Layout",
		icon: IconDivider,
		createDefault: createDefaultDivider,
		defaultSize: { width: 300, height: 16 },
	},
	{
		type: "wireframe-accordion",
		label: "Accordion",
		category: "Layout",
		icon: IconAccordion,
		createDefault: createDefaultAccordion,
		defaultSize: { width: 300, height: 200 },
	},
];
