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
	WhistleBoardOverlay,
	type WhistleRenderers,
	WhistleScreenOverlay,
} from "./overlay.js";
import type { ScreenSize } from "./viewport-moves.js";
import { createWhistleApi, whistleService } from "./whistle-service.js";

/** 波紋と方向バッジ (ボードに付く)。mode7 が傾けるレイヤーとして参照する id。 */
export const WHISTLE_LAYER_ID = "whistle-indicator";
/** プロンプト等の画面 UI。 */
export const WHISTLE_UI_LAYER_ID = "whistle-ui";

export interface WhistlePluginOptions {
	/** 自分の表示名。省略時は awareness の avatar.name / user.name。 */
	getLocalName?: () => string;
	/**
	 * false を返す間は強制移動 (全員集合・ついてきて) をかけず、承諾制の
	 * プロンプトに落とす (発表中・ドライブ中など)。既定は常に true。
	 */
	canAutoMove?: () => boolean;
	/**
	 * 文言の差し替え (i18n)。関数を渡すと描画のたびに呼ぶので、表示言語の
	 * 切り替えにも追従できる。
	 */
	labels?: WhistleLabelOverrides | (() => WhistleLabelOverrides);
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
			const getLabels = () =>
				resolveLabels(typeof options.labels === "function" ? options.labels() : options.labels);
			const labels = getLabels();
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

			// 既定では、awareness で発表中 (follow-me の `presenting`) の人には強制移動をかけない。
			function defaultCanAutoMove(): boolean {
				if (!wsProvider) return true;
				const localState = wsProvider.awareness.getStates().get(wsProvider.awareness.clientID) as
					| { presenting?: unknown }
					| undefined;
				return localState?.presenting !== true;
			}

			const controller = createWhistleController({
				store: ctx.store,
				broadcast: wsProvider ? (msg) => wsProvider.broadcast(msg) : undefined,
				getLocalName: getLocalUserName,
				getScreenSize: () => screenSize ?? getScreenSize(),
				canAutoMove: options.canAutoMove ?? defaultCanAutoMove,
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
			// HUD は registry の通知でしか isActive / isEnabled を読み直さないので、
			// 選択中の種類や ついてきて の状態が変わったら登録し直す。
			let unregisterActions: (() => void)[] = [];
			let actionsKey = "";
			const registerActions = () => {
				const s = controller.state.get();
				const key = `${s.selectedKind}\u0000${s.follow?.role ?? ""}`;
				if (key === actionsKey) return;
				actionsKey = key;
				for (const fn of unregisterActions) fn();
				unregisterActions = WHISTLE_KINDS.map((kind: WhistleKind, i) =>
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
				unregisterActions.push(
					ctx.actions.register({
						id: "whistle:end-follow",
						label: s.follow?.role === "follower" ? labels.leave : labels.end,
						group: "ホイッスル",
						order: WHISTLE_KINDS.length,
						isEnabled: () => controller.state.get().follow !== null,
						run: () => controller.endFollow(),
					}),
				);
			};
			registerActions();
			cleanups.push(controller.state.subscribe(registerActions));
			cleanups.push(() => {
				for (const fn of unregisterActions) fn();
				unregisterActions = [];
			});

			// ── 受信 ──
			if (wsProvider) {
				cleanups.push(wsProvider.onBroadcast((msg) => controller.receive(msg)));
			}

			// ── 追従中に自分で操作したら外れる ──
			// 画角の変化は controller が見ている (自分が動かした以外の変化で外れる)。
			// キャンバスを押しただけ (画角が変わらない操作) でも外れるようにする。
			cleanups.push(ctx.events.on("canvas:pointerdown", () => controller.notifyUserInteraction()));

			// ── Overlay ──
			const onResize = (size: ScreenSize) => {
				screenSize = size;
			};
			// 波紋と方向バッジはボードに付く (mode7 の傾けレイヤー対象のまま)。
			ctx.layers.register({
				id: WHISTLE_LAYER_ID,
				order: 98,
				fixed: true,
				render: () => (
					<WhistleBoardOverlay
						controller={controller}
						store={ctx.store}
						labels={getLabels()}
						renderers={renderers}
						onResize={onResize}
					/>
				),
			});
			cleanups.push(() => ctx.layers.unregister(WHISTLE_LAYER_ID));
			// プロンプト・カウントダウン・バナー・枠・フィードバックは画面に付く UI。
			ctx.layers.register({
				id: WHISTLE_UI_LAYER_ID,
				order: 99,
				fixed: true,
				render: () => (
					<WhistleScreenOverlay
						controller={controller}
						labels={getLabels()}
						renderers={renderers}
					/>
				),
			});
			cleanups.push(() => ctx.layers.unregister(WHISTLE_UI_LAYER_ID));

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
