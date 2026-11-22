import {
	type HudPanel,
	type HudRegistry,
	type HudStatus,
	isPermitted,
	type PermissionSnapshot,
} from "@edv4h/usketch-shared";

/** The side panels (`placement: "side"`) the viewer may see, in order. */
export function sidePanels(hud: HudRegistry, permissions?: PermissionSnapshot): HudPanel[] {
	return hud
		.getPanels()
		.map((e) => e.panel)
		.filter((p) => p.placement === "side" && isPermitted(permissions, p.requires));
}

/** The open side panel, if the viewer may see it. */
export function openSidePanel(hud: HudRegistry, permissions?: PermissionSnapshot): HudPanel | null {
	const id = hud.getOpenSidePanel?.() ?? null;
	if (!id) return null;
	return sidePanels(hud, permissions).find((p) => p.id === id) ?? null;
}

/** The statuses the viewer may see, in order (each may still have nothing to say). */
export function visibleStatuses(hud: HudRegistry, permissions?: PermissionSnapshot): HudStatus[] {
	return (hud.getStatuses?.() ?? [])
		.map((e) => e.status)
		.filter((s) => isPermitted(permissions, s.requires));
}
