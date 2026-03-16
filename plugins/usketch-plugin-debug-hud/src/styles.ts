import type React from "react";

export const PANEL_BG = "rgba(0, 0, 0, 0.82)";
export const PANEL_BORDER_RADIUS = 8;
export const PANEL_BLUR = "blur(8px)";
export const FONT_FAMILY = "'SF Mono', 'Fira Code', 'Consolas', monospace";
export const TEXT_COLOR = "#e0e0e0";
export const TEXT_MUTED = "#6b7280";
export const TEXT_LABEL = "#8b8b8b";
export const ACCENT = "rgba(99, 102, 241, 0.8)";
export const ACCENT_DIM = "rgba(99, 102, 241, 0.3)";
export const FPS_GREEN = "#4ade80";
export const FPS_YELLOW = "#fbbf24";
export const FPS_RED = "#f87171";

export const PANEL_BASE: React.CSSProperties = {
	background: PANEL_BG,
	color: TEXT_COLOR,
	fontFamily: FONT_FAMILY,
	fontSize: 11,
	lineHeight: "16px",
	borderRadius: PANEL_BORDER_RADIUS,
	backdropFilter: PANEL_BLUR,
	padding: 10,
	pointerEvents: "auto",
	userSelect: "none",
};

export const LABEL_STYLE: React.CSSProperties = {
	color: TEXT_LABEL,
	fontSize: 10,
	marginBottom: 2,
};

export const SECTION_STYLE: React.CSSProperties = {
	marginBottom: 6,
};

export const SCROLLABLE_STYLE: React.CSSProperties = {
	maxHeight: 200,
	overflowY: "auto",
	fontSize: 10,
	lineHeight: "14px",
};

export const MINI_BUTTON: React.CSSProperties = {
	border: "none",
	borderRadius: 4,
	background: "rgba(255, 255, 255, 0.1)",
	color: TEXT_COLOR,
	fontSize: 10,
	fontFamily: FONT_FAMILY,
	cursor: "pointer",
	padding: "2px 6px",
};

export const MINI_BUTTON_ACCENT: React.CSSProperties = {
	...MINI_BUTTON,
	background: ACCENT_DIM,
};

export const INLINE_INPUT: React.CSSProperties = {
	background: "rgba(255, 255, 255, 0.08)",
	border: "1px solid rgba(255, 255, 255, 0.15)",
	borderRadius: 3,
	color: TEXT_COLOR,
	fontFamily: FONT_FAMILY,
	fontSize: 10,
	padding: "1px 4px",
	width: 50,
	outline: "none",
};

export function fpsColor(fps: number): string {
	if (fps >= 50) return FPS_GREEN;
	if (fps >= 30) return FPS_YELLOW;
	return FPS_RED;
}

export function fmt(n: number): string {
	return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function shortId(id: string): string {
	return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}
