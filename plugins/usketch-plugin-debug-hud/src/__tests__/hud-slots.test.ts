import {
	createStaticPermissionProvider,
	type HudPanel,
	type HudRegistry,
	type HudStatus,
} from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { openSidePanel, sidePanels, visibleStatuses } from "../hud-slots.js";
import { sameStatus } from "../panels/status-bar.js";

function status(id: string, requires?: string): HudStatus {
	return { id, requires, get: () => ({ text: id }), subscribe: () => () => {} };
}

/** Just enough of a HUD registry for the selectors (the real one lives in core). */
function createHudRegistry() {
	const panels: HudPanel[] = [];
	const statuses: HudStatus[] = [];
	let open: string | null = null;
	return {
		registerPanel: (p: HudPanel) => panels.push(p),
		registerStatus: (s: HudStatus) => statuses.push(s),
		openSidePanel: (id: string) => {
			open = id;
		},
		getPanels: () => panels.map((panel) => ({ pluginId: undefined, panel })),
		getStatuses: () => statuses.map((st) => ({ pluginId: undefined, status: st })),
		getOpenSidePanel: () => open,
	} as unknown as HudRegistry & {
		registerPanel(p: HudPanel): void;
		registerStatus(s: HudStatus): void;
		openSidePanel(id: string): void;
	};
}

describe("hud slots", () => {
	it("lists only side panels the viewer may see, and the open one", () => {
		const hud = createHudRegistry();
		hud.registerPanel({ id: "dock", render: () => null });
		hud.registerPanel({ id: "chat", placement: "side", render: () => null });
		hud.registerPanel({
			id: "admin",
			placement: "side",
			requires: "board.admin",
			render: () => null,
		});
		const viewer = createStaticPermissionProvider(["page.view"]);

		expect(sidePanels(hud).map((p) => p.id)).toEqual(["chat", "admin"]);
		expect(sidePanels(hud, viewer).map((p) => p.id)).toEqual(["chat"]);

		expect(openSidePanel(hud)).toBeNull();
		hud.openSidePanel("admin");
		expect(openSidePanel(hud)?.id).toBe("admin");
		// Open, but the viewer may not see it: nothing shows.
		expect(openSidePanel(hud, viewer)).toBeNull();
	});

	it("lists the statuses the viewer may see", () => {
		const hud = createHudRegistry();
		hud.registerStatus(status("sync"));
		hud.registerStatus(status("admin", "board.admin"));
		expect(visibleStatuses(hud).map((s) => s.id)).toEqual(["sync", "admin"]);
		const viewer = createStaticPermissionProvider([]);
		expect(visibleStatuses(hud, viewer).map((s) => s.id)).toEqual(["sync"]);
	});

	it("treats status values that show the same thing as the same", () => {
		expect(sameStatus({ text: "a" }, { text: "a", tone: "info" })).toBe(true);
		expect(sameStatus({ text: "a" }, { text: "b" })).toBe(false);
		expect(sameStatus({ text: "a", tone: "danger" }, { text: "a" })).toBe(false);
		const run = () => {};
		expect(
			sameStatus(
				{ text: "a", action: { label: "x", run } },
				{ text: "a", action: { label: "x", run: () => {} } },
			),
		).toBe(true);
		expect(sameStatus(null, { text: "a" })).toBe(false);
		expect(sameStatus(null, null)).toBe(true);
	});
});
