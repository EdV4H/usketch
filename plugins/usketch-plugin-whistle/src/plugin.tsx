import {
	generateId,
	getScreenSize,
	type PluginContext,
	type UsketchPlugin,
} from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import { createWhistleController, type WhistleTimings } from "./controller.js";
import { WHISTLE_KINDS, type WhistleKind } from "./kinds.js";
import { resolveLabels, type WhistleLabelOverrides } from "./labels.js";
import {
	DEFAULT_WHISTLE_RENDERERS,
	injectWhistleStyle,
	prefersReducedMotion,
	WHISTLE_UI_ATTR,
	WhistleOverlay,
	type WhistleRenderers,
} from "./overlay.js";
import type { ScreenSize } from "./viewport-moves.js";
import { createWhistleApi, whistleService } from "./whistle-service.js";

export const WHISTLE_LAYER_ID = "whistle-indicator";

export interface WhistlePluginOptions {
	/** 自分の表示名。省略時は awareness の avatar.name / user.name。 */
	getLocalName?: () => string;
	/**
	 * false を返す間は強制移動 (全員集合・ついてきて) をかけず、承諾制の
	 * プロンプトに落とす (発表中・ドライブ中など)。既定は常に true。
	 */
	canAutoMove?: () => boolean;
	/** 文言の差し替え (i18n)。 */
	labels?: WhistleLabelOverrides;
	/** 見た目の差し替え。渡さなかったものは既定の見た目。 */
	renderers?: Partial<WhistleRenderers>;
	/** 吹くショートカット。false で登録しない。既定 "Shift+W"。 */
	shortcut?: string | false;
	/** 時間の調整 (ms)。 */
	timings?: Partial<WhistleTimings>;
}

function createPlugin(
	wsProvider: WsProviderHandle | undefined,
	options: WhistlePluginOptions,
): UsketchPlugin {
	return {
		id: "usketch-plugin-whistle",
		name: "ホイッスル",

		setup(ctx: PluginContext) {
			const cleanups: (() => void)[] = [];
			const labels = resolveLabels(options.labels);
			const renderers: WhistleRenderers = { ...DEFAULT_WHISTLE_RENDERERS, ...options.renderers };
			let screenSize: ScreenSize | null = null;

			function getLocalUserName(): string {
				if (options.getLocalName) return options.getLocalName();
				if (!wsProvider) return "";
				const localState = wsProvider.awareness.getStates().get(wsProvider.awareness.clientID) as
					| { avatar?: { name?: string }; user?: { name?: string } }
					| undefined;
				return localState?.avatar?.name ?? localState?.user?.name ?? "";
			}

			const controller = createWhistleController({
				store: ctx.store,
				broadcast: wsProvider ? (msg) => wsProvider.broadcast(msg) : undefined,
				getLocalName: getLocalUserName,
				getScreenSize: () => screenSize ?? getScreenSize(),
				canAutoMove: options.canAutoMove,
				prefersReducedMotion,
				generateId,
				timings: options.timings,
			});
			cleanups.push(() => controller.dispose());

			injectWhistleStyle();

			// ── Host API ──
			cleanups.push(whistleService.provide(ctx.services, createWhistleApi(controller)));

			// ── Shortcut: 最後に選んだ種類で吹く ──
			const shortcut = options.shortcut ?? "Shift+W";
			if (shortcut !== false) {
				cleanups.push(ctx.shortcuts.register(shortcut, () => controller.blow()));
			}

			// ── HUD: 種類ごとに吹くアクション + 案内/追従の終了 ──
			WHISTLE_KINDS.forEach((kind: WhistleKind, i) => {
				cleanups.push(
					ctx.actions.register({
						id: `whistle:blow:${kind}`,
						label: labels.kindNames[kind],
						group: "ホイッスル",
						order: i,
						run: () => {
							controller.setSelectedKind(kind);
							controller.blow(kind);
						},
						isActive: () => controller.state.get().selectedKind === kind,
					}),
				);
			});
			cleanups.push(
				ctx.actions.register({
					id: "whistle:end-follow",
					label: labels.end,
					group: "ホイッスル",
					order: WHISTLE_KINDS.length,
					isEnabled: () => controller.state.get().follow !== null,
					run: () => controller.endFollow(),
				}),
			);

			// ── 受信 ──
			if (wsProvider) {
				cleanups.push(wsProvider.onBroadcast((msg) => controller.receive(msg)));
			}

			// ── 追従中に自分で操作したら外れる ──
			const isWhistleUi = (target: EventTarget | null) =>
				target instanceof Element && target.closest(`[${WHISTLE_UI_ATTR}]`) !== null;
			cleanups.push(ctx.events.on("canvas:pointerdown", () => controller.notifyUserInteraction()));
			if (typeof window !== "undefined") {
				const onWheel = (e: WheelEvent) => {
					if (!isWhistleUi(e.target)) controller.notifyUserInteraction();
				};
				window.addEventListener("wheel", onWheel, { passive: true, capture: true });
				cleanups.push(() => window.removeEventListener("wheel", onWheel, { capture: true }));
			}

			// ── Overlay ──
			const onResize = (size: ScreenSize) => {
				screenSize = size;
			};
			ctx.layers.register({
				id: WHISTLE_LAYER_ID,
				order: 98,
				fixed: true,
				render: () => (
					<WhistleOverlay
						controller={controller}
						store={ctx.store}
						labels={labels}
						renderers={renderers}
						onResize={onResize}
					/>
				),
			});
			cleanups.push(() => ctx.layers.unregister(WHISTLE_LAYER_ID));

			return () => {
				for (const fn of cleanups.reverse()) fn();
				cleanups.length = 0;
			};
		},
	};
}

/**
 * ホイッスル plugin。`wsProvider` は broadcast / onBroadcast だけを使う
 * (Yjs awareness で同期する host はアダプタを渡せばよい)。
 */
export function createWhistlePlugin(
	wsProvider?: WsProviderHandle,
	options: WhistlePluginOptions = {},
): UsketchPlugin {
	return createPlugin(wsProvider, options);
}
