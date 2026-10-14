import type {
	CommandRegistry,
	LayerRenderContext,
	PluginContext,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
import { useEffect, useState } from "react";
import { OpenSlideDeckRegistry } from "./open-slide/deck-registry.js";
import { OpenSlideEditState } from "./open-slide/edit-state.js";
import {
	createOpenSlideApi,
	openSlideService,
	setOpenSlidePage,
} from "./open-slide/open-slide-service.js";
import { createOpenSlideShapeDefinition } from "./open-slide/open-slide-shape.js";
import { setOpenSlideText } from "./open-slide/overrides.js";
import { MutablePresentCursor } from "./open-slide/present-cursor.js";
import { isOpenSlideShape, OPEN_SLIDE_SHAPE_TYPE, type OpenSlideDeck } from "./open-slide/types.js";
import { PresentEditOverlay } from "./present-edit-overlay.js";
import { PresentModeOverlay } from "./present-mode-overlay.js";
import type { GetStepCount, IsSlide } from "./slide-navigator.js";
import { defaultIsSlide, SlideNavigator } from "./slide-navigator.js";

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
	/**
	 * open-slide (https://github.com/1weiho/open-slide) のデッキを置ける Shape を有効にする。
	 * 有効にすると `open-slide` Shape・挿入 action・{@link getOpenSlideApi} サービスが登録され、
	 * open-slide Shape は `isSlide` に関係なく常にスライドとして並ぶ。発表では →/Space で
	 * デッキ内のページを送り、最終ページの次で次のスライドへ進む。
	 */
	openSlide?: {
		/** 置けるデッキ。モジュールは表示時に遅延 import する。 */
		decks: readonly OpenSlideDeck[];
	};
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
	const openSlide = opts.openSlide;

	return {
		id: "presentation",
		name: "Presentation",
		setup(ctx: PluginContext) {
			const unregisters: Array<() => void> = [];
			const deckRegistry = openSlide ? new OpenSlideDeckRegistry(openSlide.decks) : null;
			const baseIsSlide = isSlide ?? defaultIsSlide;
			const navIsSlide: IsSlide | undefined = deckRegistry
				? (s) => isOpenSlideShape(s) || baseIsSlide(s)
				: isSlide;
			const getStepCount: GetStepCount | undefined = deckRegistry
				? (s) =>
						isOpenSlideShape(s) ? (deckRegistry.getPageCount(s.deckId) ?? s.pageCount ?? 1) : 1
				: undefined;
			let nav: SlideNavigator | null = new SlideNavigator(ctx.store, getViewportSize, {
				isSlide: navIsSlide,
				fitPadding,
				getStepCount,
			});
			const navRef = nav;

			if (deckRegistry) {
				// 発表中の現在位置を open-slide Shape に流し、画角に入ったデッキだけが
				// 発表のステップ (ページ) を表示する。
				const presentCursor = new MutablePresentCursor();
				const syncPresentCursor = () => {
					if (getMode() !== "present") {
						presentCursor.set(null);
						return;
					}
					const slide = navRef.getSlides()[navRef.getCurrentIndex()];
					presentCursor.set(slide ? { shapeId: slide.id, step: navRef.getCurrentStep() } : null);
				};
				unregisters.push(navRef.onChange(syncPresentCursor));
				unregisters.push(subscribeMode(syncPresentCursor));
				syncPresentCursor();

				// デッキの中身の編集中に発表へ入ったら編集を終える。
				const editState = new OpenSlideEditState();
				unregisters.push(
					subscribeMode(() => {
						if (getMode() === "present") editState.end();
					}),
				);

				ctx.shapes.register(
					OPEN_SLIDE_SHAPE_TYPE,
					createOpenSlideShapeDefinition({
						registry: deckRegistry,
						presentCursor,
						onSetPage: (shapeId, page) => setOpenSlidePage(ctx.store, deckRegistry, shapeId, page),
						editState,
						onCommitText: (shapeId, params) =>
							setOpenSlideText(ctx.store, ctx.commands, shapeId, params),
					}),
				);

				const api = createOpenSlideApi({
					store: ctx.store,
					commands: ctx.commands,
					registry: deckRegistry,
					editState,
					getViewportSize,
				});
				unregisters.push(openSlideService.provide(ctx.services, api));
				const decks = deckRegistry.getDecks();
				unregisters.push(
					ctx.actions.register({
						id: "presentation:insert-open-slide",
						label: "open-slide デッキを置く",
						group: "Presentation",
						params: [
							{
								name: "deckId",
								label: "デッキ",
								type: "enum",
								options: decks.map((d) => ({ value: d.id, label: d.title })),
								default: decks[0]?.id,
							},
						],
						run: (args) => {
							const deckId = typeof args.deckId === "string" ? args.deckId : decks[0]?.id;
							if (deckId) api.insertDeck({ deckId });
						},
						isEnabled: () => decks.length > 0,
					}),
				);
				const selectedDeckId = (): string | null => {
					const selection = ctx.store.getSelection();
					if (selection.size !== 1) return null;
					const [id] = selection;
					const shape = id ? ctx.store.getShape(id) : undefined;
					return shape && isOpenSlideShape(shape) ? shape.id : null;
				};
				unregisters.push(
					ctx.actions.register({
						id: "presentation:edit-open-slide",
						label: "デッキの中身を編集",
						group: "Presentation",
						run: () => {
							const id = selectedDeckId();
							if (id) api.beginEdit(id);
						},
						isEnabled: () => selectedDeckId() !== null,
					}),
				);
				unregisters.push(
					ctx.actions.register({
						id: "presentation:reset-open-slide",
						label: "デッキを元の内容に戻す",
						group: "Presentation",
						run: () => {
							const id = selectedDeckId();
							if (id) api.resetOverrides(id);
						},
						isEnabled: () => selectedDeckId() !== null,
					}),
				);
			}

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
