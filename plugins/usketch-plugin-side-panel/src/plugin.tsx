import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { SidePanelUI } from "./side-panel-ui.js";
import { createTabStore } from "./tab-store.js";
import type { SidePanelRegisterEvent, SidePanelUnregisterEvent } from "./types.js";

/**
 * NOTE: このプラグインは `side-panel:register-tab` / `side-panel:unregister-tab`
 * イベントを setup 時に listen する。EventBus は過去の emit を replay しないため、
 * タブを登録する側のプラグイン（ai-chat / comments / activity-feed 等）より
 * **先に** plugin 配列に入れて setup されている必要がある。
 *
 * 順序を誤るとタブが表示されない（silent failure）ので、apps 側でコメントで
 * 明示することを推奨。
 */
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
