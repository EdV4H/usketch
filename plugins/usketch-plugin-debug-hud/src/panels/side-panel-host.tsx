import type { HudPanel, HudRegistry, PermissionProvider } from "@edv4h/usketch-shared";
import type React from "react";
import { useEffect, useReducer } from "react";
import { openSidePanel, sidePanels } from "../hud-slots.js";
import { STOP_CANVAS_PROPAGATION } from "../stop-propagation.js";
import { ACCENT, ACCENT_DIM, MINI_BUTTON, PANEL_BASE, TEXT_MUTED } from "../styles.js";

/** Width of the open side panel (the right column of the HUD moves left by this much). */
export const SIDE_PANEL_WIDTH = 360;

/**
 * The HUD's side panel: the open `placement: "side"` panel at the right edge, with a tab per
 * side panel. Stays on screen while the rest of the HUD is closed, so people can keep a chat
 * or comments open while they work. Opened by `hud.openSidePanel(id)` (actions, the dock).
 */
export function SidePanelHost({
	hud,
	permissions,
}: {
	hud: HudRegistry;
	permissions?: PermissionProvider;
}) {
	const [, bump] = useReducer((n: number) => n + 1, 0);
	useEffect(() => hud.subscribe(bump), [hud]);
	useEffect(() => permissions?.subscribe(bump), [permissions]);

	const open = openSidePanel(hud, permissions);
	if (!open) return null;
	const tabs = sidePanels(hud, permissions);

	return (
		<div {...STOP_CANVAS_PROPAGATION} style={hostStyle} data-testid="hud-side-panel">
			<div style={headerStyle}>
				<div style={{ display: "flex", gap: 4, overflowX: "auto", flex: 1 }}>
					{tabs.map((tab) => (
						<button
							key={tab.id}
							type="button"
							onClick={() => hud.openSidePanel?.(tab.id)}
							style={tab.id === open.id ? activeTabStyle : tabStyle}
							title={tab.title ?? tab.id}
						>
							{tab.icon && <TabIcon render={tab.icon} />}
							<span>{tab.title ?? tab.id}</span>
						</button>
					))}
				</div>
				<button
					type="button"
					onClick={() => hud.closeSidePanel?.()}
					style={MINI_BUTTON}
					title="閉じる"
					aria-label="サイドパネルを閉じる"
				>
					✕
				</button>
			</div>
			<div style={bodyStyle}>
				<SidePanelBody panel={open} />
			</div>
		</div>
	);
}

function SidePanelBody({ panel }: { panel: HudPanel }) {
	try {
		return panel.render();
	} catch (err) {
		console.error(`HUD side panel "${panel.id}" failed to render:`, err);
		return <div style={{ color: "#f87171", fontSize: 10 }}>panel error: {panel.id}</div>;
	}
}

function TabIcon({ render }: { render: () => React.ReactElement }) {
	try {
		return render();
	} catch {
		return null;
	}
}

const hostStyle: React.CSSProperties = {
	...PANEL_BASE,
	position: "absolute",
	top: 8,
	right: 8,
	bottom: 8,
	width: SIDE_PANEL_WIDTH,
	padding: 0,
	display: "flex",
	flexDirection: "column",
	userSelect: "text",
	zIndex: 1,
};

const headerStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: 6,
	padding: 6,
	borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
};

const tabStyle: React.CSSProperties = {
	...MINI_BUTTON,
	display: "inline-flex",
	alignItems: "center",
	gap: 4,
	whiteSpace: "nowrap",
	background: "transparent",
	color: TEXT_MUTED,
};

const activeTabStyle: React.CSSProperties = {
	...tabStyle,
	background: ACCENT_DIM,
	color: ACCENT,
};

const bodyStyle: React.CSSProperties = {
	flex: 1,
	minHeight: 0,
	overflowY: "auto",
	padding: 10,
};
