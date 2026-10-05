import type {
	CommandRegistry,
	LayerRenderContext,
	PluginContext,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
import { useEffect, useState } from "react";
import { PresentEditOverlay } from "./present-edit-overlay.js";
import { PresentModeOverlay } from "./present-mode-overlay.js";
import type { IsSlide } from "./slide-navigator.js";
import { SlideNavigator } from "./slide-navigator.js";

/** "off" = プレゼン UI 非表示（通常のホワイトボード扱い） */
export type PresentationMode = "off" | "edit" | "present";

export interface PresentationPluginOptions {
	/**
	 * 現在のモードを返す関数。URL から動的に読む前提。
	 * mode 切替時に app 全体を再生成しないために、getter で渡す。
	 */
	getMode: () => PresentationMode;
	/**
	 * モード変化を監視したいとき用の購読 API。省略時は window の popstate を使う。
	 */
	subscribeMode?: (listener: () => void) => () => void;
	/**
	 * 通常のホワイトボード（/boards/:boardId）へ戻るためのナビゲーション。
	 * apps/web 側で react-router の navigate を渡す。省略時は window.location.assign。
	 */
	navigateToBoard?: () => void;
	/**
	 * SlideNavigator.fitToBounds で使う viewport サイズを返す。
	 * 編集モード時は Canvas が stage 矩形に縮退するため、ウィンドウ全体ではなく
	 * stage のサイズを返したい。省略時は window.innerWidth/Height を使う。
	 */
	getViewportSize?: () => { width: number; height: number };
	/**
	 * どの shape を「スライド」として扱うかの述語。省略時は Frame シェイプ。
	 * ホスト側で「スライド指定した Frame だけ」や専用の画角 shape を対象にしたいときに渡す。
	 */
	isSlide?: IsSlide;
	/**
	 * edit モードのオーバーレイ（スライド一覧パネル）を plugin 側で描画するか。
	 * 省略時は true。ホスト側で独自のスライド一覧 UI を持つ場合は false にして、
	 * present モードのオーバーレイとショートカットだけ流用できる。
	 */
	renderEditUI?: boolean;
	/**
	 * present オーバーレイの「終了」操作。省略時は URL クエリ (?mode=edit) を書き換える。
	 * state 駆動のホストは `() => setPresenting(false)` 等を渡す。
	 */
	onExit?: () => void;
	/** present 時に画角 (現スライド) 以外の Canvas を暗幕で隠すか (overlay トグルの初期値)。 */
	mask?: boolean;
	/**
	 * スライドに寄せるときの fitToBounds 余白 (px)。省略時 40。
	 * 発表でスライドを画角いっぱい (上下または左右が端に接する) にしたいときは 0。
	 * 余白 0 のレターボックスは mask で暗転できる。
	 */
	fitPadding?: number;
}

function defaultGetViewportSize(): { width: number; height: number } {
	return { width: window.innerWidth, height: window.innerHeight };
}

function defaultSubscribeMode(listener: () => void): () => void {
	window.addEventListener("popstate", listener);
	return () => window.removeEventListener("popstate", listener);
}

function defaultNavigateToBoard(): void {
	// plugin 単独での最終手段。apps/web からは navigateToBoard を注入して SPA 遷移を使う。
	// ?present / ?mode クエリを落として通常ホワイトボードに戻す。
	const url = new URL(window.location.href);
	url.searchParams.delete("present");
	url.searchParams.delete("mode");
	window.history.replaceState(null, "", url.toString());
	window.dispatchEvent(new PopStateEvent("popstate"));
}

export function createPresentationPlugin(opts: PresentationPluginOptions): UsketchPlugin {
	const getMode = opts.getMode;
	const subscribeMode = opts.subscribeMode ?? defaultSubscribeMode;
	const navigateToBoard = opts.navigateToBoard ?? defaultNavigateToBoard;
	const getViewportSize = opts.getViewportSize ?? defaultGetViewportSize;
	const isSlide = opts.isSlide;
	const renderEditUI = opts.renderEditUI ?? true;
	const onExit = opts.onExit;
	const mask = opts.mask;
	const fitPadding = opts.fitPadding;

	return {
		id: "presentation",
		name: "Presentation",
		setup(ctx: PluginContext) {
			let nav: SlideNavigator | null = new SlideNavigator(ctx.store, getViewportSize, {
				isSlide,
				fitPadding,
			});
			const unregisters: Array<() => void> = [];
			const navRef = nav;

			// 発表モード中のみ動くショートカット群（mode を実行時に毎回評価する）
			const ifPresent = (fn: () => void) => () => {
				if (getMode() === "present") fn();
			};
			unregisters.push(
				ctx.shortcuts.register(
					"ArrowRight",
					ifPresent(() => navRef.next()),
				),
			);
			unregisters.push(
				ctx.shortcuts.register(
					"ArrowLeft",
					ifPresent(() => navRef.prev()),
				),
			);
			unregisters.push(
				ctx.shortcuts.register(
					"Home",
					ifPresent(() => navRef.first()),
				),
			);
			unregisters.push(
				ctx.shortcuts.register(
					"End",
					ifPresent(() => navRef.last()),
				),
			);
			unregisters.push(
				ctx.shortcuts.register(
					"Escape",
					ifPresent(() => {
						const url = new URL(window.location.href);
						url.searchParams.set("present", "1");
						url.searchParams.set("mode", "edit");
						window.history.replaceState(null, "", url.toString());
						// replaceState は popstate を発火させないので明示的に通知する
						window.dispatchEvent(new PopStateEvent("popstate"));
					}),
				),
			);

			// Space キーは shortcut-registry のキー名正規化（trim）で扱えないため、
			// window 経由で直接ハンドリングする。PageDown / PageUp も同様に発表向けで受ける。
			const onKeyDown = (e: KeyboardEvent) => {
				if (getMode() !== "present") return;
				const target = e.target as HTMLElement | null;
				if (target && (target.isContentEditable || /input|textarea/i.test(target.tagName))) return;
				if (e.ctrlKey || e.metaKey || e.altKey) return;
				if (e.key === " " || e.key === "PageDown") {
					e.preventDefault();
					navRef.next();
				} else if (e.key === "PageUp") {
					e.preventDefault();
					navRef.prev();
				}
			};
			window.addEventListener("keydown", onKeyDown);
			unregisters.push(() => window.removeEventListener("keydown", onKeyDown));

			// 発表モード突入時の初回 fit は PresentModeOverlay の useEffect (mount 後) に委ねる。
			// plugin レイヤーで即座に fit すると、Canvas コンテナの縮退解除より前の
			// 古いサイズで計算されてズームがずれる。ここではモード変化の購読だけ行い、
			// navRef の fit は呼ばない。
			let prevMode = getMode();
			const syncOnModeChange = () => {
				const current = getMode();
				if (current !== prevMode) {
					prevMode = current;
				}
			};
			unregisters.push(subscribeMode(syncOnModeChange));

			// レイヤー: mode に応じて edit (パネル) / present (オーバーレイ) を出し分ける。
			// react 側で LayerRenderContext を経由して再 render されるので、子コンポーネント
			// が mode を内部状態で購読する。
			const layerId = "presentation-overlay";
			const commandsRef: CommandRegistry = ctx.commands;
			ctx.layers.register({
				id: layerId,
				order: 200,
				fixed: true,
				render: (renderCtx: LayerRenderContext) => {
					if (!nav) return null;
					return (
						<PresentationLayer
							nav={nav}
							store={ctx.store}
							commands={commandsRef}
							renderCtx={renderCtx}
							getMode={getMode}
							subscribeMode={subscribeMode}
							navigateToBoard={navigateToBoard}
							renderEditUI={renderEditUI}
							onExit={onExit}
							mask={mask}
						/>
					);
				},
			});
			unregisters.push(() => ctx.layers.unregister(layerId));

			return () => {
				for (const u of unregisters) u();
				unregisters.length = 0;
				nav?.destroy();
				nav = null;
			};
		},
	};
}

/**
 * モード変化に応じて edit / present の UI を切り替えるラッパ。
 * plugin 本体の teardown を起こさないため、URL の mode クエリをここで購読する。
 */
interface PresentationLayerProps {
	nav: SlideNavigator;
	store: PluginContext["store"];
	commands: CommandRegistry;
	renderCtx: LayerRenderContext;
	getMode: () => PresentationMode;
	subscribeMode: (listener: () => void) => () => void;
	navigateToBoard: () => void;
	renderEditUI: boolean;
	onExit?: () => void;
	mask?: boolean;
}

function PresentationLayer({
	nav,
	store,
	commands,
	renderCtx,
	getMode,
	subscribeMode,
	navigateToBoard,
	renderEditUI,
	onExit,
	mask,
}: PresentationLayerProps) {
	const [mode, setMode] = usePresentationMode(getMode, subscribeMode);
	void setMode;
	if (mode === "off") return null;
	if (mode === "present") return <PresentModeOverlay nav={nav} onExit={onExit} mask={mask} />;
	void renderCtx;
	// edit モードのパネルはホスト側が持つ場合 renderEditUI=false で抑止する。
	if (!renderEditUI) return null;
	return (
		<PresentEditOverlay
			nav={nav}
			store={store}
			commands={commands}
			navigateToBoard={navigateToBoard}
		/>
	);
}

function usePresentationMode(
	getMode: () => PresentationMode,
	subscribeMode: (listener: () => void) => () => void,
): [PresentationMode, (m: PresentationMode) => void] {
	const [mode, setMode] = useState<PresentationMode>(getMode);
	useEffect(() => {
		const update = () => setMode(getMode());
		update();
		return subscribeMode(update);
	}, [getMode, subscribeMode]);
	return [mode, setMode];
}
