import {
	type CanvasPointerEvent,
	type Command,
	DEFAULT_STYLE,
	generateId,
	type PluginContext,
	type Point,
	type ShapeData,
	type ToolContext,
	type UsketchPlugin,
	withRotation,
	zIndexAfterAll,
} from "@edv4h/usketch-shared";
import { createAddShapeCommand, createUpdateShapeCommand } from "@edv4h/usketch-store";
import { drawN, drawTop, shuffle } from "./deck.js";
import {
	CARD_TYPE,
	createBareCardShape,
	createCardShape,
	createDeckShape,
	DECK_TYPE,
} from "./factory.js";
import { getBounds, gridPositions, makeAspectResize, rectHitTest } from "./geometry.js";
import { HandPanel } from "./hand-panel.js";
import { type CardHandAwareness, createHandStore, type HandCardEntry } from "./hand-store.js";
import {
	injectPlacementStyles,
	PLACEMENT_TRANSIENT_TYPE,
	PlacementEffect,
	resolvePlacementAnimation,
	type SlamPlay,
} from "./placement.js";
import { createCardTypeRegistry } from "./registry.js";
import { createCardRenderer } from "./render-card.js";
import { createDeckRenderer } from "./render-deck.js";
import { createCardSimplified, createDeckSimplified } from "./render-simplified.js";
import {
	type CardTypeDefinition,
	type DeckMeta,
	type PlacementAnimation,
	readCardMeta,
	readDeckMeta,
} from "./types.js";

const DOUBLE_CLICK_MS = 400;
const GENERIC_ACCENT = "rgba(79, 140, 255, 0.9)";

export interface CreateCardPluginOptions {
	/**
	 * 使用する card-type。**既定は空**で、空でもプラグインは生成できる（描画ツールは出ない）。
	 * トランプ等のサンプルを使うには `EXAMPLE_CARD_TYPES` を渡す。
	 */
	cardTypes?: CardTypeDefinition[];
	/** 既定の配置アニメ（card-type 個別指定が優先される）。 */
	placementAnimation?: PlacementAnimation;
	/** デッキ機構を有効にするか。既定 true。 */
	enableDeck?: boolean;
	/**
	 * カード / デッキをリサイズ可能にするか（プラグイン全体の既定）。既定 `true`。
	 * `CardTypeDefinition.resizable` が指定されていれば card-type 単位でそちらが優先される。
	 * `false` にすると、対象カード・デッキはハンドル非表示・リサイズ操作無効（サイズ固定）になる。
	 */
	resizable?: boolean;
	/** 手札(hand)のローカル保持キーに使うユーザー id。既定 `"local"`。 */
	userId?: string;
	/** 手札の localStorage キーを board 単位に分けるための board id（任意）。 */
	boardId?: string;
	/**
	 * 手札**枚数**の共有用 awareness を持つ wsProvider（任意）。渡すと他者に「N枚保持中」を
	 * 見せられる。無ければ手札はローカルのみで動作（枚数共有なし）。手札の中身は共有しない。
	 */
	wsProvider?: { awareness: CardHandAwareness };
	/**
	 * 旧来のダブルクリック操作（カード=めくり / デッキ=1枚ドロー）を有効にするか。既定 `false`。
	 * これらは操作メニューに移行済み。グローバルな pointerdown 監視で select 等と競合しうるため
	 * 既定で無効。後方互換で戻したい場合のみ `true`。
	 */
	legacyDoubleClickActions?: boolean;
}

// ── icons ──

function CardIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<title>Card</title>
			<rect
				x="5"
				y="3"
				width="10"
				height="14"
				rx="2"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<line x1="7" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.2" />
		</svg>
	);
}

function DeckIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<title>Deck</title>
			<rect
				x="4"
				y="6"
				width="9"
				height="12"
				rx="1.5"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.3"
			/>
			<rect
				x="7"
				y="3"
				width="9"
				height="12"
				rx="1.5"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.3"
			/>
		</svg>
	);
}

export function createCardPlugin(opts: CreateCardPluginOptions = {}): UsketchPlugin {
	const registry = createCardTypeRegistry(opts.cardTypes);
	const enableDeck = opts.enableDeck ?? true;
	// slam 中の実カード（card/deck）を持ち上げ→着地アニメさせるための再生状態。
	const slamming = new Map<string, SlamPlay>();
	let slamNonce = 0;
	const getSlam = (id: string) => slamming.get(id);
	const renderCard = createCardRenderer(registry, getSlam);
	const renderDeck = createDeckRenderer(registry);
	const cardSimplified = createCardSimplified(registry);
	const deckSimplified = createDeckSimplified(registry);
	const hasCardTypes = registry.size > 0;

	// 既定の card-type（先頭。空なら ""）
	const firstType = opts.cardTypes?.[0]?.id ?? "";

	/** 現在の card-type を解決。無ければ登録順の先頭にフォールバック（空なら undefined）。 */
	function resolveDef(id: string): CardTypeDefinition | undefined {
		return registry.get(id) ?? registry.values().next().value;
	}

	function getCardAspect(data: ShapeData): number {
		const meta = data.type === DECK_TYPE ? readDeckMeta(data) : readCardMeta(data);
		const def = meta.cardType ? registry.get(meta.cardType) : undefined;
		return def?.aspectRatio ?? data.width / data.height;
	}
	const resize = makeAspectResize(getCardAspect);

	// resizable は card-type 単位 (CardTypeDefinition.resizable) を最優先、無ければ
	// プラグイン全体既定 (opts.resizable)、それも無ければ true。card / card-deck は
	// 単一 shape type なので、shape の cardType を見て per-instance で解決する。
	function resolveResizable(data: ShapeData): boolean {
		const meta = data.type === DECK_TYPE ? readDeckMeta(data) : readCardMeta(data);
		const def = meta.cardType ? registry.get(meta.cardType) : undefined;
		if (typeof def?.resizable === "boolean") return def.resizable;
		if (typeof opts.resizable === "boolean") return opts.resizable;
		return true;
	}

	return {
		id: "usketch-plugin-shape-card",
		name: "カード",

		setup(ctx: PluginContext) {
			injectPlacementStyles();

			let currentCardType = firstType;

			// ── card-type 切替（ツールバーのピッカーから） ──
			const offSelectType = ctx.events.on<{ id: string }>("card:select-type", (data) => {
				if (registry.has(data.id)) currentCardType = data.id;
			});

			// ── 配置アニメーション（transient） ──
			ctx.transient.registerType(PLACEMENT_TRANSIENT_TYPE, {
				render: (obj) => <PlacementEffect obj={obj} />,
			});

			function emitPlacement(shape: ShapeData) {
				// デッキ（山札）は配置アニメ不要。
				if (shape.type === DECK_TYPE) return;
				const meta = readCardMeta(shape);
				const def = meta.cardType ? registry.get(meta.cardType) : undefined;
				const resolved = resolvePlacementAnimation(
					def?.placementAnimation,
					opts.placementAnimation,
				);
				if (!resolved) return;
				const data: Record<string, unknown> =
					resolved.kind === "slam"
						? {
								width: shape.width,
								height: shape.height,
								slam: resolved.weight,
								durationMs: resolved.durationMs,
							}
						: {
								width: shape.width,
								height: shape.height,
								name: resolved.name,
								durationMs: resolved.durationMs,
								easing: resolved.easing,
								accent: GENERIC_ACCENT,
							};
				ctx.transient.emit({
					id: generateId(),
					type: PLACEMENT_TRANSIENT_TYPE,
					sourceUserId: "local",
					position: { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 },
					data,
					ttl: resolved.durationMs,
					createdAt: Date.now(),
				});

				// slam は実カード自身を持ち上げ→着地アニメさせる。
				// render が getSlam を参照するので、状態をセットしてから再レンダを促す。
				if (resolved.kind === "slam") {
					slamNonce += 1;
					slamming.set(shape.id, {
						weight: resolved.weight,
						durationMs: resolved.durationMs,
						nonce: slamNonce,
					});
					// 移動後（既にレンダ済み）でも再生されるよう、無害な更新で再レンダを発火。
					ctx.store.updateShape(shape.id, {});
					setTimeout(() => slamming.delete(shape.id), resolved.durationMs + 200);
				}
			}

			function isCardLike(type: string): boolean {
				return type === CARD_TYPE || (enableDeck && type === DECK_TYPE);
			}

			// 出現演出（placement アニメ）は「手札から場に出したとき」だけに限定する。
			// デッキドロー / バラし / 手動ドロー / 移動では再生しない（playCardFromHand のみ emit）。

			// ── flip / deck-draw インタラクション（ダブルクリック検出） ──
			let lastClickTime = 0;
			let lastClickId: string | null = null;

			function topHitAt(point: Point): ShapeData | null {
				const sorted = ctx.store.getShapesSorted();
				for (let i = sorted.length - 1; i >= 0; i--) {
					const shape = sorted[i];
					if (!isCardLike(shape.type)) continue;
					// shape 登録側の hitTest（withRotation 込み）を使い、選択ツールと判定を一致させる
					const def = ctx.shapes.get(shape.type);
					const hit = def?.hitTest ? def.hitTest(shape, point) : rectHitTest(shape, point);
					if (hit) return shape;
				}
				return null;
			}

			function flipCard(shape: ShapeData) {
				const m = readCardMeta(shape);
				// view 状態なので command 履歴には積まない（sticky の isEditing と同様）
				ctx.store.updateShape(shape.id, {
					meta: { ...m, isFlipped: !(m.isFlipped ?? false) } as ShapeData["meta"],
				});
			}

			function drawFromDeck(deck: ShapeData) {
				const meta = readDeckMeta(deck);
				const cardType = meta.cardType;
				const def = cardType ? registry.get(cardType) : undefined;
				if (!def || !cardType) return;
				const cards = meta.cards ?? [];
				const { card: fields, rest } = drawTop(cards);
				if (!fields) return;

				const allZ = ctx.store.getShapesSorted().map((s) => s.zIndex);
				const newCard = createCardShape(def, {
					x: deck.x + deck.width + 16,
					y: deck.y,
					fields,
					zIndex: zIndexAfterAll(allZ),
				});

				const deckBefore: DeckMeta = { cardType, cards, faceDown: meta.faceDown ?? true };
				const deckAfter: DeckMeta = { cardType, cards: rest, faceDown: meta.faceDown ?? true };

				const command: Command = {
					execute() {
						ctx.store.updateShape(deck.id, { meta: deckAfter as ShapeData["meta"] });
						ctx.store.addShape(newCard);
					},
					undo() {
						ctx.store.deleteShape(newCard.id);
						ctx.store.updateShape(deck.id, { meta: deckBefore as ShapeData["meta"] });
					},
				};
				ctx.commands.execute(command);
				ctx.store.setSelection([newCard.id]);
			}

			// N 個の zIndex を「全 shape の上」に積んで返す。各値は直前を含めて計算するので
			// 互いに重ならず、この順で上へ重なる（配置は非重複だが決定的な前後関係を保つ）。
			function zStackAboveAll(count: number): string[] {
				let allZ = ctx.store.getShapesSorted().map((s) => s.zIndex);
				const out: string[] = [];
				for (let i = 0; i < count; i++) {
					const z = zIndexAfterAll(allZ);
					out.push(z);
					allZ = [...allZ, z];
				}
				return out;
			}

			// デッキから複数の card fields を取り出し、指定レイアウトで場に展開する共通処理。
			// `layout(n)` は n 枚ぶんのワールド座標を返す。単一 Command で Undo/Redo 可能。
			function spreadCards(
				deck: ShapeData,
				drawn: Record<string, unknown>[],
				restCards: Record<string, unknown>[],
				layout: (n: number) => Point[],
			) {
				const meta = readDeckMeta(deck);
				const cardType = meta.cardType;
				const def = cardType ? registry.get(cardType) : undefined;
				if (!def || !cardType || drawn.length === 0) return;

				const positions = layout(drawn.length);
				const zStack = zStackAboveAll(drawn.length);
				const newCards = drawn.map((fields, i) =>
					createCardShape(def, {
						x: positions[i]?.x ?? deck.x,
						y: positions[i]?.y ?? deck.y,
						fields,
						zIndex: zStack[i],
					}),
				);

				const deckBefore: DeckMeta = {
					cardType,
					cards: [...drawn, ...restCards],
					faceDown: meta.faceDown ?? true,
				};
				const deckAfter: DeckMeta = { cardType, cards: restCards, faceDown: meta.faceDown ?? true };

				ctx.commands.execute({
					execute() {
						ctx.store.updateShape(deck.id, { meta: deckAfter as ShapeData["meta"] });
						for (const c of newCards) ctx.store.addShape(c);
					},
					undo() {
						for (const c of newCards) ctx.store.deleteShape(c.id);
						ctx.store.updateShape(deck.id, { meta: deckBefore as ShapeData["meta"] });
					},
				});
				ctx.store.setSelection(newCards.map((c) => c.id));
			}

			const SPREAD_GAP = 16;

			// 場に N 枚引く: デッキの右隣に1列で並べる。
			function drawManyFromDeck(deck: ShapeData, count: number) {
				const meta = readDeckMeta(deck);
				const def = meta.cardType ? registry.get(meta.cardType) : undefined;
				if (!def) return;
				const { drawn, rest } = drawN(meta.cards ?? [], count);
				const stepX = def.defaultSize.width + SPREAD_GAP;
				spreadCards(deck, drawn, rest, (n) =>
					gridPositions(n, {
						cols: n, // 1 行
						stepX,
						stepY: 0,
						originX: deck.x + deck.width + SPREAD_GAP,
						originY: deck.y,
					}),
				);
			}

			// デッキをバラす: 全カードを回転なし・等間隔の折り返しグリッドで場に展開し、山札を空にする。
			function scatterDeck(deck: ShapeData) {
				const meta = readDeckMeta(deck);
				const def = meta.cardType ? registry.get(meta.cardType) : undefined;
				if (!def) return;
				const cards = meta.cards ?? [];
				if (cards.length === 0) return;
				const stepX = def.defaultSize.width + SPREAD_GAP;
				const stepY = def.defaultSize.height + SPREAD_GAP;
				// 画面幅（ワールド換算）に収まる列数で折り返す。
				const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
				const zoom = ctx.store.getViewport().zoom || 1;
				const availableWorld = (vw * 0.9) / zoom;
				const cols = Math.max(1, Math.min(cards.length, Math.floor(availableWorld / stepX)));
				spreadCards(deck, cards, [], (n) =>
					gridPositions(n, {
						cols,
						stepX,
						stepY,
						originX: deck.x + deck.width + SPREAD_GAP,
						originY: deck.y,
					}),
				);
			}

			// ── 手札(hand): 内容はローカル限定、枚数だけ awareness 共有（#671 / 真 private は #686） ──
			const localUserId = opts.userId ?? "local";
			const handStore = createHandStore(localUserId, opts.boardId);
			const awareness = opts.wsProvider?.awareness;

			function broadcastHandCount() {
				awareness?.setLocalStateField("cardHand", {
					userId: localUserId,
					count: handStore.count(),
				});
			}
			broadcastHandCount();

			function viewportCenterWorld(): Point {
				const vp = ctx.store.getViewport();
				const w = typeof window !== "undefined" ? window.innerWidth : 1200;
				const h = typeof window !== "undefined" ? window.innerHeight : 800;
				return { x: (w / 2 - vp.x) / vp.zoom, y: (h / 2 - vp.y) / vp.zoom };
			}

			// カードを手札に入れる: shape を共有ストアから削除し内容をローカル手札へ（undo 可能）。
			function moveCardToHand(id: string) {
				const shape = ctx.store.getShape(id);
				if (!shape || shape.type !== CARD_TYPE) return;
				const m = readCardMeta(shape);
				if (!m.cardType) return; // bare card は手札化しない
				const snapshot = { ...shape };
				const entry: HandCardEntry = {
					id: shape.id,
					cardType: m.cardType,
					fields: (m.fields ?? {}) as Record<string, unknown>,
					width: shape.width,
					height: shape.height,
				};
				ctx.commands.execute({
					execute() {
						ctx.store.deleteShape(id);
						handStore.addToHand(entry);
						broadcastHandCount();
					},
					undo() {
						ctx.store.addShape(snapshot);
						handStore.removeFromHand(id);
						broadcastHandCount();
					},
				});
			}

			// 手札のカードを場に出す: ローカル手札から取り出し shape を再追加（undo 可能）。
			function playCardFromHand(id: string) {
				const entry = handStore.getHand().find((e) => e.id === id);
				if (!entry) return;
				const def = registry.get(entry.cardType);
				if (!def) return;
				const center = viewportCenterWorld();
				const allZ = ctx.store.getShapesSorted().map((s) => s.zIndex);
				const card = createCardShape(def, {
					id: entry.id,
					x: center.x - entry.width / 2,
					y: center.y - entry.height / 2,
					width: entry.width,
					height: entry.height,
					fields: entry.fields,
					zIndex: zIndexAfterAll(allZ),
				});
				ctx.commands.execute({
					execute() {
						handStore.removeFromHand(id);
						ctx.store.addShape(card);
						broadcastHandCount();
					},
					undo() {
						ctx.store.deleteShape(card.id);
						handStore.addToHand(entry);
						broadcastHandCount();
					},
				});
				ctx.store.setSelection([card.id]);
				emitPlacement(card);
			}

			// 手札に N 枚引く: デッキから取り出し、場に出さず直接ローカル手札へ入れる（Undo 可能）。
			function drawToHandFromDeck(deck: ShapeData, count: number) {
				const meta = readDeckMeta(deck);
				const cardType = meta.cardType;
				const def = cardType ? registry.get(cardType) : undefined;
				if (!def || !cardType) return;
				const cards = meta.cards ?? [];
				const { drawn, rest } = drawN(cards, count);
				if (drawn.length === 0) return;

				const entries: HandCardEntry[] = drawn.map((fields) => ({
					id: generateId(),
					cardType,
					fields: fields as Record<string, unknown>,
					width: def.defaultSize.width,
					height: def.defaultSize.height,
				}));

				const deckBefore: DeckMeta = { cardType, cards, faceDown: meta.faceDown ?? true };
				const deckAfter: DeckMeta = { cardType, cards: rest, faceDown: meta.faceDown ?? true };

				ctx.commands.execute({
					execute() {
						ctx.store.updateShape(deck.id, { meta: deckAfter as ShapeData["meta"] });
						for (const e of entries) handStore.addToHand(e);
						broadcastHandCount();
					},
					undo() {
						for (const e of entries) handStore.removeFromHand(e.id);
						ctx.store.updateShape(deck.id, { meta: deckBefore as ShapeData["meta"] });
						broadcastHandCount();
					},
				});
			}

			// ── 操作メニュー / トレイからのイベント ──
			const offFlip = ctx.events.on<{ id: string }>("card:flip", ({ id }) => {
				const shape = ctx.store.getShape(id);
				if (shape?.type === CARD_TYPE) flipCard(shape);
			});
			const offDraw = ctx.events.on<{ id: string }>("card-deck:draw", ({ id }) => {
				const deck = ctx.store.getShape(id);
				if (enableDeck && deck?.type === DECK_TYPE) drawFromDeck(deck);
			});
			const offDrawMany = ctx.events.on<{ id: string; count: number }>(
				"card-deck:draw-many",
				({ id, count }) => {
					const deck = ctx.store.getShape(id);
					if (enableDeck && deck?.type === DECK_TYPE) drawManyFromDeck(deck, count);
				},
			);
			const offDrawToHand = ctx.events.on<{ id: string; count: number }>(
				"card-deck:draw-to-hand",
				({ id, count }) => {
					const deck = ctx.store.getShape(id);
					if (enableDeck && deck?.type === DECK_TYPE) drawToHandFromDeck(deck, count);
				},
			);
			const offScatter = ctx.events.on<{ id: string }>("card-deck:scatter", ({ id }) => {
				const deck = ctx.store.getShape(id);
				if (enableDeck && deck?.type === DECK_TYPE) scatterDeck(deck);
			});
			const offToHand = ctx.events.on<{ id: string }>("card:to-hand", ({ id }) =>
				moveCardToHand(id),
			);
			const offPlayFromHand = ctx.events.on<{ id: string }>("card:play-from-hand", ({ id }) =>
				playCardFromHand(id),
			);

			// ── 操作を Action として公開（Control HUD が自動でUI化） ──
			const selectedOfType = (type: string): string | undefined => {
				for (const id of ctx.store.getSelection()) {
					if (ctx.store.getShape(id)?.type === type) return id;
				}
				return undefined;
			};
			const offActions: Array<() => void> = [];
			if (hasCardTypes) {
				offActions.push(
					ctx.actions.register({
						id: "card:select-type",
						label: "Card type",
						group: "Card",
						params: [
							{
								name: "id",
								type: "enum",
								default: firstType,
								options: [...registry.values()].map((d) => ({ value: d.id, label: d.label })),
							},
						],
						run: ({ id }) => ctx.events.emit("card:select-type", { id }),
					}),
					ctx.actions.register({
						id: "card:flip",
						label: "Flip selected card",
						group: "Card",
						isEnabled: () => selectedOfType(CARD_TYPE) !== undefined,
						run: () => {
							const id = selectedOfType(CARD_TYPE);
							if (id) ctx.events.emit("card:flip", { id });
						},
					}),
					ctx.actions.register({
						id: "card:to-hand",
						label: "Selected card → hand",
						group: "Card",
						isEnabled: () => selectedOfType(CARD_TYPE) !== undefined,
						run: () => {
							const id = selectedOfType(CARD_TYPE);
							if (id) ctx.events.emit("card:to-hand", { id });
						},
					}),
				);
				if (enableDeck) {
					offActions.push(
						ctx.actions.register({
							id: "card-deck:draw",
							label: "Draw from selected deck",
							group: "Card",
							isEnabled: () => selectedOfType(DECK_TYPE) !== undefined,
							run: () => {
								const id = selectedOfType(DECK_TYPE);
								if (id) ctx.events.emit("card-deck:draw", { id });
							},
						}),
						ctx.actions.register({
							id: "card-deck:shuffle",
							label: "Shuffle selected deck",
							group: "Card",
							isEnabled: () => selectedOfType(DECK_TYPE) !== undefined,
							run: () => {
								const id = selectedOfType(DECK_TYPE);
								if (id) ctx.events.emit("card-deck:shuffle", { id });
							},
						}),
						ctx.actions.register({
							id: "card-deck:draw-many",
							label: "Draw cards to board",
							group: "Card",
							params: [{ name: "count", type: "number", default: 5, min: 1, max: 52, step: 1 }],
							isEnabled: () => selectedOfType(DECK_TYPE) !== undefined,
							run: ({ count }) => {
								const id = selectedOfType(DECK_TYPE);
								if (id) ctx.events.emit("card-deck:draw-many", { id, count: Number(count) || 5 });
							},
						}),
						ctx.actions.register({
							id: "card-deck:draw-to-hand",
							label: "Draw to hand",
							group: "Card",
							params: [{ name: "count", type: "number", default: 1, min: 1, max: 52, step: 1 }],
							isEnabled: () => selectedOfType(DECK_TYPE) !== undefined,
							run: ({ count }) => {
								const id = selectedOfType(DECK_TYPE);
								if (id)
									ctx.events.emit("card-deck:draw-to-hand", { id, count: Number(count) || 1 });
							},
						}),
						ctx.actions.register({
							id: "card-deck:scatter",
							label: "Spread deck",
							group: "Card",
							isEnabled: () => selectedOfType(DECK_TYPE) !== undefined,
							run: () => {
								const id = selectedOfType(DECK_TYPE);
								if (id) ctx.events.emit("card-deck:scatter", { id });
							},
						}),
					);
				}
			}

			// ── 旧来のダブルクリック操作（既定 OFF。操作メニューへ移行済み。#671） ──
			const offPointerDown = opts.legacyDoubleClickActions
				? ctx.events.on<CanvasPointerEvent>("canvas:pointerdown", (event) => {
						const hit = topHitAt(event.worldPoint);
						const now = Date.now();
						if (hit && now - lastClickTime < DOUBLE_CLICK_MS && lastClickId === hit.id) {
							if (hit.type === CARD_TYPE) flipCard(hit);
							else if (enableDeck && hit.type === DECK_TYPE) drawFromDeck(hit);
							lastClickTime = 0;
							lastClickId = null;
							return;
						}
						lastClickTime = now;
						lastClickId = hit?.id ?? null;
					})
				: undefined;

			// ── シャッフル（選択中のデッキを Shift+S） ──
			const offShuffleEvent = ctx.events.on<{ id?: string }>("card-deck:shuffle", (data) => {
				const ids = data?.id ? [data.id] : [...ctx.store.getSelection()];
				shuffleDecks(ids);
			});
			function shuffleDecks(ids: string[]) {
				for (const id of ids) {
					const deck = ctx.store.getShape(id);
					if (!deck || deck.type !== DECK_TYPE) continue;
					const m = readDeckMeta(deck);
					const before: DeckMeta = {
						cardType: m.cardType ?? "",
						cards: m.cards ?? [],
						faceDown: m.faceDown ?? true,
					};
					const after: DeckMeta = { ...before, cards: shuffle(before.cards) };
					// Command 経由で更新し Undo/Redo 可能にする
					ctx.commands.execute(
						createUpdateShapeCommand(
							ctx.store,
							id,
							{ meta: before } as Partial<ShapeData>,
							{ meta: after } as Partial<ShapeData>,
						),
					);
				}
			}
			const offShuffleShortcut = enableDeck
				? ctx.shortcuts.register("Shift+S", () => shuffleDecks([...ctx.store.getSelection()]))
				: undefined;

			// ── shape 登録: card ──
			ctx.shapes.register(CARD_TYPE, {
				render: renderCard,
				getBounds,
				hitTest: withRotation(rectHitTest),
				resize,
				resizable: resolveResizable,
				simplifiedComponent: cardSimplified,
				createDefault: ({ id, x, y }) => {
					const def = resolveDef(currentCardType);
					return def ? createCardShape(def, { id, x, y }) : createBareCardShape({ id, x, y });
				},
				renderTarget: "html",
				minSize: { width: 60, height: 60 },
				serializeForAi: (shape) => {
					const m = readCardMeta(shape);
					const f = (m.fields ?? {}) as Record<string, unknown>;
					const text = [f.title, f.body, f.rank, f.suit, f.value]
						.filter((v) => typeof v === "string" && v)
						.join(" ");
					return { cardType: m.cardType ?? "", text, isFlipped: m.isFlipped ?? false };
				},
				debugFields: (shape) => {
					const m = readCardMeta(shape);
					return {
						cardType: m.cardType ?? "",
						isFlipped: m.isFlipped ?? false,
						fields: m.fields ?? {},
					};
				},
			});

			// ── 描画ツール: card-draw（card-type が1つ以上ある時だけ登録） ──
			let drawState: { startX: number; startY: number; shapeId: string } | null = null;

			if (hasCardTypes)
				ctx.tools.register("card-draw", {
					icon: CardIcon,
					cursor: "crosshair",
					shortcut: "k",
					order: 27,
					onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
						const def = resolveDef(currentCardType);
						if (!def) return;
						const draft = createCardShape(def, {
							x: event.worldPoint.x,
							y: event.worldPoint.y,
							width: 0,
							height: 0,
						});
						drawState = {
							startX: event.worldPoint.x,
							startY: event.worldPoint.y,
							shapeId: draft.id,
						};
						toolCtx.store.addShape(draft);
					},
					onPointerMove(toolCtx: ToolContext, event: CanvasPointerEvent) {
						if (!drawState) return;
						const aspect = resolveDef(currentCardType)?.aspectRatio ?? 1;
						const dx = event.worldPoint.x - drawState.startX;
						const dy = event.worldPoint.y - drawState.startY;
						const width = Math.abs(dx);
						const height = width / aspect;
						const x = dx >= 0 ? drawState.startX : drawState.startX - width;
						const y = dy >= 0 ? drawState.startY : drawState.startY - height;
						toolCtx.store.updateShape(drawState.shapeId, { x, y, width, height });
					},
					onPointerUp(toolCtx: ToolContext) {
						if (!drawState) return;
						const def = resolveDef(currentCardType);
						const draft = toolCtx.store.getShape(drawState.shapeId);
						toolCtx.store.deleteShape(drawState.shapeId);

						if (draft && draft.width > 2 && draft.height > 2) {
							toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, draft));
							toolCtx.store.setSelection([draft.id]);
						} else if (def) {
							// クリック: 既定サイズで配置（クリック点を中心に）
							const placed = createCardShape(def, {
								id: drawState.shapeId,
								x: drawState.startX - def.defaultSize.width / 2,
								y: drawState.startY - def.defaultSize.height / 2,
							});
							toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, placed));
							toolCtx.store.setSelection([placed.id]);
						}
						drawState = null;
						toolCtx.store.resetToDefaultTool();
					},
				});

			// ── shape 登録 + ツール: deck（card-type がある時だけツールを出す） ──
			if (enableDeck) {
				ctx.shapes.register(DECK_TYPE, {
					render: renderDeck,
					getBounds,
					hitTest: withRotation(rectHitTest),
					resize,
					resizable: resolveResizable,
					simplifiedComponent: deckSimplified,
					createDefault: ({ id, x, y }) => {
						const def = resolveDef(currentCardType);
						return def
							? createDeckShape(def, { id, x, y })
							: {
									id,
									type: DECK_TYPE,
									x,
									y,
									width: 200,
									height: 280,
									style: { ...DEFAULT_STYLE },
									meta: { cardType: "", cards: [], faceDown: true },
								};
					},
					renderTarget: "html",
					minSize: { width: 60, height: 60 },
					debugFields: (shape) => {
						const m = readDeckMeta(shape);
						return {
							cardType: m.cardType ?? "",
							count: (m.cards ?? []).length,
							faceDown: m.faceDown ?? true,
						};
					},
				});

				if (hasCardTypes)
					ctx.tools.register("card-deck-draw", {
						icon: DeckIcon,
						cursor: "crosshair",
						order: 28,
						onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
							const def = resolveDef(currentCardType);
							if (!def) return;
							const deck = createDeckShape(def, {
								x: event.worldPoint.x - def.defaultSize.width / 2,
								y: event.worldPoint.y - def.defaultSize.height / 2,
							});
							toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, deck));
							toolCtx.store.setSelection([deck.id]);
							toolCtx.store.resetToDefaultTool();
						},
					});
			}

			// カード操作の追従メニューは Control HUD の Action(card:*)に統合したため撤去。

			// ── 手札は Control HUD の「Hand」パネルとして登録（独自トレイUIは廃止） ──
			// 自分の手札のみ中身を表示。他者は枚数のみ（awareness）。
			const offHandPanel = ctx.hud.registerPanel({
				id: "usketch-plugin-shape-card:hand",
				title: "Hand",
				order: 0,
				render: () => (
					<HandPanel
						handStore={handStore}
						registry={registry}
						localUserId={localUserId}
						awareness={awareness}
						onPlay={(id) => ctx.events.emit("card:play-from-hand", { id })}
					/>
				),
			});

			// ── teardown ──
			return () => {
				offSelectType();
				offPointerDown?.();
				offShuffleEvent();
				offShuffleShortcut?.();
				offFlip();
				offDraw();
				offDrawMany();
				offDrawToHand();
				offScatter();
				offToHand();
				offPlayFromHand();
				for (const off of offActions) off();
				offHandPanel();
				awareness?.setLocalStateField("cardHand", null);
			};
		},
	};
}
