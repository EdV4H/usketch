import {
	type BoardStore,
	type CommandRegistry,
	defineService,
	generateId,
	type Point,
	type ServiceRegistry,
	screenToWorld,
} from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";
import type { OpenSlideDeckRegistry } from "./deck-registry.js";
import type { OpenSlideEditState } from "./edit-state.js";
import { createOpenSlideShapeData } from "./open-slide-shape.js";
import { resetOpenSlideOverrides, setOpenSlidePalette } from "./overrides.js";
import { isOpenSlideShape, type OpenSlideDeck, type OpenSlideDesign } from "./types.js";

export interface InsertOpenSlideDeckOptions {
	deckId: string;
	/** 置く中心 (world)。省略時は画面中央。 */
	center?: Point;
	/** 幅 (world px)。省略時は既定幅。 */
	width?: number;
}

/** 発表プラグインの open-slide 操作。ホストは {@link getOpenSlideApi} で取得する。 */
export interface OpenSlideApi {
	/** 登録済みデッキの一覧。 */
	getDecks(): OpenSlideDeck[];
	/** デッキ Shape をボードに置く（undo 可）。未登録の deckId なら null。 */
	insertDeck(options: InsertOpenSlideDeckOptions): string | null;
	/** 編集時に表示するページを変える。 */
	setPage(shapeId: string, page: number): void;
	/** デッキの中身の編集を始める (デッキのダブルクリックと同じ)。 */
	beginEdit(shapeId: string): void;
	/** デッキの中身の編集を終える。 */
	endEdit(): void;
	/** いま中身を編集しているデッキ Shape の id。 */
	getEditingId(): string | null;
	/** {@link getEditingId} の変化を購読する。 */
	subscribeEditing(listener: () => void): () => void;
	/** 配色を差し替える（undo 可）。null の色はデッキ側に戻す。 */
	setPalette(
		shapeId: string,
		palette: { [K in keyof OpenSlideDesign["palette"]]?: string | null },
	): void;
	/** 差し替えをすべて消してデッキ側の内容に戻す（undo 可）。 */
	resetOverrides(shapeId: string): void;
}

export const openSlideService = defineService<OpenSlideApi>(
	"usketch-plugin-presentation:open-slide",
);

export function getOpenSlideApi(services: ServiceRegistry): OpenSlideApi | undefined {
	return openSlideService.get(services);
}

/** open-slide デッキ Shape の表示ページを書き換える（範囲外は clamp）。 */
export function setOpenSlidePage(
	store: BoardStore,
	registry: OpenSlideDeckRegistry,
	shapeId: string,
	page: number,
): void {
	const shape = store.getShape(shapeId);
	if (!shape || !isOpenSlideShape(shape)) return;
	const total = registry.getPageCount(shape.deckId) ?? shape.pageCount;
	const next = Math.max(0, Math.min(Math.floor(page), Math.max(1, total) - 1));
	if (next === shape.page) return;
	store.updateShape(shapeId, { page: next } as Partial<typeof shape>);
}

export interface CreateOpenSlideApiDeps {
	store: BoardStore;
	commands: CommandRegistry;
	registry: OpenSlideDeckRegistry;
	editState: OpenSlideEditState;
	getViewportSize: () => { width: number; height: number };
}

export function createOpenSlideApi({
	store,
	commands,
	registry,
	editState,
	getViewportSize,
}: CreateOpenSlideApiDeps): OpenSlideApi {
	return {
		getDecks: () => registry.getDecks(),
		insertDeck: ({ deckId, center, width }) => {
			const deck = registry.getDeck(deckId);
			if (!deck) return null;
			const size = getViewportSize();
			const at = center ?? screenToWorld(size.width / 2, size.height / 2, store.getViewport());
			const shape = createOpenSlideShapeData({
				id: generateId(),
				deck,
				center: at,
				width,
				pageCount: registry.getPageCount(deck.id),
			});
			commands.execute(createAddShapeCommand(store, shape));
			// ページ数を発表のステップ数に使うので、挿入と同時に読み込みを始める。
			registry.load(deck.id).then(
				(module) => {
					const current = store.getShape(shape.id);
					if (current && isOpenSlideShape(current) && current.pageCount !== module.default.length) {
						store.updateShape(shape.id, { pageCount: module.default.length } as Partial<
							typeof current
						>);
					}
				},
				() => {},
			);
			return shape.id;
		},
		setPage: (shapeId, page) => setOpenSlidePage(store, registry, shapeId, page),
		beginEdit: (shapeId) => {
			const shape = store.getShape(shapeId);
			if (shape && isOpenSlideShape(shape)) editState.begin(shapeId);
		},
		endEdit: () => editState.end(),
		getEditingId: editState.get,
		subscribeEditing: editState.subscribe,
		setPalette: (shapeId, palette) => setOpenSlidePalette(store, commands, shapeId, palette),
		resetOverrides: (shapeId) => resetOpenSlideOverrides(store, commands, shapeId),
	};
}
