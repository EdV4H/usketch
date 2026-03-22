import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { SidePanelUI } from "./side-panel-ui.js";
import { createTabStore } from "./tab-store.js";
import type { SidePanelRegisterEvent, SidePanelUnregisterEvent } from "./types.js";

export function createSidePanelPlugin(): UsketchPlugin {
	let cleanup: (() => void) | undefined;

	return {
		id: "usketch-plugin-side-panel",
		name: "Side Panel",

		setup(ctx: PluginContext) {
			const tabStore = createTabStore();

			// EventBus → TabStore ブリッジ（プラグインsetup中のemitもキャッチ）
			const unsubRegister = ctx.events.on<SidePanelRegisterEvent>(
				"side-panel:register-tab",
				({ tab }) => {
					tabStore.register(tab);
				},
			);

			const unsubUnregister = ctx.events.on<SidePanelUnregisterEvent>(
				"side-panel:unregister-tab",
				({ tabId }) => {
					tabStore.unregister(tabId);
				},
			);

			ctx.layers.register({
				id: "side-panel",
				order: 190,
				fixed: true,
				render: () => <SidePanelUI events={ctx.events} tabStore={tabStore} />,
			});

			cleanup = () => {
				unsubRegister();
				unsubUnregister();
				ctx.layers.unregister("side-panel");
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}
