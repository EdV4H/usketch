/**
 * Design tokens and reusable style objects for the demo app UI.
 *
 * NOTE: デザインモック適用の段階移行中。新規コードは `apps/web/src/styles/tokens.css`
 * の CSS 変数（`var(--brand-gradient)` など）を優先して参照し、このファイルの
 * 定数は既存コードの互換レイヤーとして一時的に維持している。全面移行後に削除予定。
 */

// ── Colors ──

export const colors = {
	brand: "#0066ff",
	brandHover: "#0052cc",

	textPrimary: "#333",
	textSecondary: "#666",
	textMuted: "#999",
	textSubtle: "#888",

	error: "#c33",
	errorBorder: "#fcc",

	surfaceWhite: "#fff",
	surfaceLight: "#fafafa",
	surfaceMuted: "#f5f5f5",
	surfaceDim: "#f0f0f0",

	borderLight: "#eee",
	borderDefault: "#ddd",
	borderStrong: "#e0e0e0",

	activeBackground: "#e3f2fd",
	activeText: "#1976d2",

	copilotOnBg: "#e8f5e9",
	copilotOnText: "#2e7d32",

	voiceOnBg: "#fce4ec",
	voiceOnText: "#c62828",
} as const;

// ── Shadows ──

export const shadows = {
	panel: "0 2px 8px rgba(0,0,0,0.12)",
	dropdown: "0 4px 16px rgba(0,0,0,0.15)",
	dialog: "0 8px 32px rgba(0,0,0,0.2)",
	palette: "0 4px 12px rgba(0,0,0,0.12)",
} as const;

// ── Z-Index ──

export const zIndex = {
	toolbar: 100,
	picker: 150,
	palette: 200,
	modalBackdrop: 200,
	modalContent: 201,
} as const;

// ── Font ──

export const fontFamily = "system-ui, sans-serif";

// ── Reusable Style Objects ──

export const floatingPanelStyle: React.CSSProperties = {
	background: colors.surfaceWhite,
	borderRadius: 8,
	boxShadow: shadows.panel,
	zIndex: zIndex.toolbar,
};

export const actionBtnStyle: React.CSSProperties = {
	width: 36,
	height: 36,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	border: "none",
	borderRadius: 6,
	background: "transparent",
	color: colors.textSecondary,
	cursor: "pointer",
	fontSize: 11,
	fontWeight: 600,
};

export const menuItemStyle: React.CSSProperties = {
	display: "block",
	width: "100%",
	padding: "10px 16px",
	border: "none",
	background: "none",
	textAlign: "left",
	fontSize: 13,
	cursor: "pointer",
	color: colors.textPrimary,
};

export const dropdownStyle: React.CSSProperties = {
	position: "absolute",
	background: colors.surfaceWhite,
	borderRadius: 8,
	boxShadow: shadows.dropdown,
	overflow: "hidden",
	minWidth: 120,
};

export const dialogBackdropStyle: React.CSSProperties = {
	position: "fixed",
	inset: 0,
	background: "rgba(0,0,0,0.3)",
	zIndex: zIndex.modalBackdrop,
};

export const dialogContentStyle: React.CSSProperties = {
	position: "fixed",
	top: "50%",
	left: "50%",
	transform: "translate(-50%, -50%)",
	background: colors.surfaceWhite,
	borderRadius: 12,
	padding: 24,
	zIndex: zIndex.modalContent,
	boxShadow: shadows.dialog,
	fontFamily,
};

export const dividerStyle: React.CSSProperties = {
	width: 1,
	height: 24,
	background: colors.borderStrong,
	margin: "0 2px",
};

export const cardStyle: React.CSSProperties = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	padding: "12px 16px",
	border: `1px solid ${colors.borderLight}`,
	borderRadius: 8,
};

export const textInputStyle: React.CSSProperties = {
	padding: "8px 10px",
	border: `1px solid ${colors.borderDefault}`,
	borderRadius: 6,
	fontSize: 13,
};

export const dangerBtnStyle: React.CSSProperties = {
	padding: "4px 8px",
	border: `1px solid ${colors.errorBorder}`,
	borderRadius: 4,
	background: colors.surfaceWhite,
	color: colors.error,
	cursor: "pointer",
	fontSize: 11,
};
