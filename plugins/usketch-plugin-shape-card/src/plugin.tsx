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
import { createAddShapeCommand } from "@edv4h/usketch-store";
import { drawTop, shuffle } from "./deck.js";
import { getBounds, makeAspectResize, rectHitTest } from "./geometry.js";
import {
	injectPlacementStyles,
	PLACEMENT_TRANSIENT_TYPE,
	PlacementEffect,
	resolvePlacementAnimation,
} from "./placement.js";
import { createCardTypeRegistry } from "./registry.js";
import { createCardRenderer } from "./render-card.js";
import { createDeckRenderer } from "./render-deck.js";
import {
	type CardTypeDefinition,
	type DeckMeta,
	type PlacementAnimation,
	readCardMeta,
	readDeckMeta,
} from "./types.js";

const CARD_TYPE = "card";
const DECK_TYPE = "card-deck";
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
	const renderCard = createCardRenderer(registry);
	const renderDeck = createDeckRenderer(registry);
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
				const meta = shape.type === DECK_TYPE ? readDeckMeta(shape) : readCardMeta(shape);
				const def = meta.cardType ? registry.get(meta.cardType) : undefined;
				const resolved = resolvePlacementAnimation(
					def?.placementAnimation,
					opts.placementAnimation,
				);
				if (!resolved) return;
				ctx.transient.emit({
					id: generateId(),
					type: PLACEMENT_TRANSIENT_TYPE,
					sourceUserId: "local",
					position: { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 },
					data: {
						width: shape.width,
						height: shape.height,
						name: resolved.name,
						durationMs: resolved.durationMs,
						easing: resolved.easing,
						accent: GENERIC_ACCENT,
					},
					ttl: resolved.durationMs,
					createdAt: Date.now(),
				});
			}

			function isCardLike(type: string): boolean {
				return type === CARD_TYPE || (enableDeck && type === DECK_TYPE);
			}

			// 新規配置時のアニメは描画ツール / デッキ操作の確定点で明示的に emit する
			// （shape:added を購読すると、保存済みボードのロード時に全カードが一斉に
			// アニメしてしまうため、対話的な配置だけに絞る）。

			// 移動後: shapes:move-end
			const offMoveEnd = ctx.events.on<{ shapeIds: string[] }>("shapes:move-end", (data) => {
				if (!data?.shapeIds) return;
				for (const id of data.shapeIds) {
					const shape = ctx.store.getShape(id);
					if (shape && isCardLike(shape.type)) emitPlacement(shape);
				}
			});

			// ── flip / deck-draw インタラクション（ダブルクリック検出） ──
			let lastClickTime = 0;
			let lastClickId: string | null = null;

			function topHitAt(point: Point): ShapeData | null {
				const sorted = ctx.store.getShapesSorted();
				for (let i = sorted.length - 1; i >= 0; i--) {
					const shape = sorted[i];
					if (!isCardLike(shape.type)) continue;
					if (rectHitTest(shape, point)) return shape;
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
				const newCard: ShapeData = {
					id: generateId(),
					type: CARD_TYPE,
					x: deck.x + deck.width + 16,
					y: deck.y,
					width: def.defaultSize.width,
					height: def.defaultSize.height,
					style: { ...DEFAULT_STYLE },
					zIndex: zIndexAfterAll(allZ),
					meta: { cardType, isFlipped: false, fields } as ShapeData["meta"],
				};

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
				emitPlacement(newCard);
			}

			const offPointerDown = ctx.events.on<CanvasPointerEvent>("canvas:pointerdown", (event) => {
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
			});

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
					ctx.store.updateShape(id, {
						meta: { ...m, cards: shuffle(m.cards ?? []) } as ShapeData["meta"],
					});
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
				createDefault: ({ id, x, y }) => {
					const def = resolveDef(currentCardType);
					return {
						id,
						type: CARD_TYPE,
						x,
						y,
						width: def?.defaultSize.width ?? 200,
						height: def?.defaultSize.height ?? 280,
						style: { ...DEFAULT_STYLE },
						meta: {
							cardType: def?.id ?? "",
							isFlipped: false,
							fields: def?.createDefaultFields() ?? {},
						} as ShapeData["meta"],
					};
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
						const id = generateId();
						drawState = { startX: event.worldPoint.x, startY: event.worldPoint.y, shapeId: id };
						toolCtx.store.addShape({
							id,
							type: CARD_TYPE,
							x: event.worldPoint.x,
							y: event.worldPoint.y,
							width: 0,
							height: 0,
							style: { ...DEFAULT_STYLE },
							meta: {
								cardType: def.id,
								isFlipped: false,
								fields: def.createDefaultFields(),
							} as ShapeData["meta"],
						});
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
							emitPlacement(draft);
						} else if (def) {
							// クリック: 既定サイズで配置（クリック点を中心に）
							const placed: ShapeData = {
								id: drawState.shapeId,
								type: CARD_TYPE,
								x: drawState.startX - def.defaultSize.width / 2,
								y: drawState.startY - def.defaultSize.height / 2,
								width: def.defaultSize.width,
								height: def.defaultSize.height,
								style: { ...DEFAULT_STYLE },
								meta: {
									cardType: def.id,
									isFlipped: false,
									fields: def.createDefaultFields(),
								} as ShapeData["meta"],
							};
							toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, placed));
							toolCtx.store.setSelection([placed.id]);
							emitPlacement(placed);
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
					createDefault: ({ id, x, y }) => {
						const def = resolveDef(currentCardType);
						return {
							id,
							type: DECK_TYPE,
							x,
							y,
							width: def?.defaultSize.width ?? 200,
							height: def?.defaultSize.height ?? 280,
							style: { ...DEFAULT_STYLE },
							meta: {
								cardType: def?.id ?? "",
								cards: def?.buildDeck?.() ?? [],
								faceDown: true,
							} as ShapeData["meta"],
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
							const id = generateId();
							const deck: ShapeData = {
								id,
								type: DECK_TYPE,
								x: event.worldPoint.x - def.defaultSize.width / 2,
								y: event.worldPoint.y - def.defaultSize.height / 2,
								width: def.defaultSize.width,
								height: def.defaultSize.height,
								style: { ...DEFAULT_STYLE },
								meta: {
									cardType: def.id,
									cards: def.buildDeck?.() ?? [],
									faceDown: true,
								} as ShapeData["meta"],
							};
							toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, deck));
							toolCtx.store.setSelection([id]);
							emitPlacement(deck);
							toolCtx.store.resetToDefaultTool();
						},
					});
			}

			// ── teardown ──
			return () => {
				offSelectType();
				offMoveEnd();
				offPointerDown();
				offShuffleEvent();
				offShuffleShortcut?.();
			};
		},
	};
}
