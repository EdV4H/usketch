import type { ShapeData } from "@edv4h/usketch-shared";

/** Accordion wireframe: expandable sections. */
export interface WireframeAccordionShapeData extends ShapeData {
	sections: string[];
	expandedIndex: number;
}

/** Alert wireframe: inline status message. */
export interface WireframeAlertShapeData extends ShapeData {
	alertMessage: string;
	alertType: "info" | "success" | "warning" | "error" | string;
}

/** Avatar wireframe: circular identity marker. */
export interface WireframeAvatarShapeData extends ShapeData {
	avatarLabel: string;
}

/** Badge wireframe: small label/tag. */
export interface WireframeBadgeShapeData extends ShapeData {
	badgeLabel: string;
	badgeVariant: "default" | "primary" | "secondary" | string;
}

/** Breadcrumb wireframe: hierarchical navigation trail. */
export interface WireframeBreadcrumbShapeData extends ShapeData {
	items: string[];
}

/** Button wireframe: clickable action. */
export interface WireframeButtonShapeData extends ShapeData {
	label: string;
	variant: "primary" | "secondary" | "outline" | string;
}

/** Card wireframe: titled content container. */
export interface WireframeCardShapeData extends ShapeData {
	cardTitle: string;
	cardContent: string;
}

/** Checkbox wireframe: toggleable option with label. */
export interface WireframeCheckboxShapeData extends ShapeData {
	checkboxLabel: string;
	checked: boolean;
}

/** Container wireframe: labeled layout region. */
export interface WireframeContainerShapeData extends ShapeData {
	containerTitle: string;
	borderStyle: "solid" | "dashed" | "dotted" | string;
}

/** Divider wireframe: horizontal separator. */
export interface WireframeDividerShapeData extends ShapeData {
	dividerStyle: "solid" | "dashed" | "dotted" | string;
}

/** Image wireframe: image placeholder. */
export interface WireframeImageShapeData extends ShapeData {
	imageAlt: string;
}

/** Input wireframe: single-line form field. */
export interface WireframeInputShapeData extends ShapeData {
	placeholder?: string;
	inputLabel?: string;
	inputType?: "text" | "password" | string;
}

/** List wireframe: bulleted items. */
export interface WireframeListShapeData extends ShapeData {
	listItems: string[];
}

/** Modal wireframe: dialog with header + body. */
export interface WireframeModalShapeData extends ShapeData {
	modalTitle: string;
	modalContent: string;
}

/** Navbar wireframe: top navigation bar. */
export interface WireframeNavbarShapeData extends ShapeData {
	items: string[];
	brand: string;
}

/** Progress wireframe: progress bar. */
export interface WireframeProgressShapeData extends ShapeData {
	progress: number;
	progressLabel?: string;
}

/** Select wireframe: dropdown field. */
export interface WireframeSelectShapeData extends ShapeData {
	placeholder?: string;
	options?: string[];
}

/** Sidebar wireframe: vertical navigation menu. */
export interface WireframeSidebarShapeData extends ShapeData {
	items: string[];
	sidebarTitle: string;
}

/** Table wireframe: tabular grid. */
export interface WireframeTableShapeData extends ShapeData {
	columns: string[];
	rows: number;
}

/** Tabs wireframe: tabbed navigation. */
export interface WireframeTabsShapeData extends ShapeData {
	tabs: string[];
	activeIndex: number;
}

/** Toast wireframe: transient notification. */
export interface WireframeToastShapeData extends ShapeData {
	toastMessage: string;
	toastType: "success" | "error" | "warning" | "info" | string;
}
