import type {
	BoundingBox,
	Point,
	ResizeHandle,
	ShapeData,
	ShapeDefinition,
} from "@edv4h/usketch-shared";
import type { OpenSlideDeckRegistry } from "./deck-registry.js";
import { OpenSlideShapeView } from "./open-slide-shape-view.js";
import type { PresentCursor } from "./present-cursor.js";
import {
	OPEN_SLIDE_ASPECT,
	OPEN_SLIDE_SHAPE_TYPE,
	type OpenSlideDeck,
	type OpenSlideShapeData,
} from "./types.js";

/** 挿入時の既定の幅 (world px)。高さは 16:9 で決まる。 */
export const OPEN_SLIDE_DEFAULT_WIDTH = 960;
/** リサイズの最小幅 (world px)。 */
export const OPEN_SLIDE_MIN_WIDTH = 160;

export interface CreateOpenSlideShapeParams {
	id: string;
	deck: Pick<OpenSlideDeck, "id">;
	/** Shape の中心 (world)。 */
	center: Point;
	/** 幅 (world px)。省略時 {@link OPEN_SLIDE_DEFAULT_WIDTH}。 */
	width?: number;
	/** 分かっていればデッキのページ数。未読み込みなら 1。 */
	pageCount?: number;
}

/** open-slide デッキ Shape のデータを作る（store には追加しない純関数）。 */
export function createOpenSlideShapeData(params: CreateOpenSlideShapeParams): OpenSlideShapeData {
	const width = Math.max(OPEN_SLIDE_MIN_WIDTH, params.width ?? OPEN_SLIDE_DEFAULT_WIDTH);
	const height = width / OPEN_SLIDE_ASPECT;
	return {
		id: params.id,
		type: OPEN_SLIDE_SHAPE_TYPE,
		x: params.center.x - width / 2,
		y: params.center.y - height / 2,
		width,
		height,
		style: { fill: "#ffffff", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		deckId: params.deck.id,
		page: 0,
		pageCount: Math.max(1, Math.floor(params.pageCount ?? 1)),
	};
}

/** 16:9 を保ったリサイズ。辺ハンドルは反対側の辺の中央を固定する。 */
export function resizeOpenSlideShape(
	data: ShapeData,
	handle: ResizeHandle,
	delta: Point,
): ShapeData {
	const vertical = handle === "n" || handle === "s";
	let width: number;
	if (vertical) {
		const dh = handle === "n" ? -delta.y : delta.y;
		width = (data.height + dh) * OPEN_SLIDE_ASPECT;
	} else {
		const dw = handle.includes("w") ? -delta.x : delta.x;
		width = data.width + dw;
	}
	width = Math.max(OPEN_SLIDE_MIN_WIDTH, width);
	const height = width / OPEN_SLIDE_ASPECT;

	let x = data.x;
	let y = data.y;
	if (handle.includes("w")) x = data.x + (data.width - width);
	if (handle.includes("n")) y = data.y + (data.height - height);
	if (vertical) x = data.x + (data.width - width) / 2;
	if (handle === "e" || handle === "w") y = data.y + (data.height - height) / 2;
	return { ...data, x, y, width, height };
}

function getBounds(data: ShapeData): BoundingBox {
	return { x: data.x, y: data.y, width: data.width, height: data.height };
}

function hitTest(data: ShapeData, point: Point): boolean {
	return (
		point.x >= data.x &&
		point.x <= data.x + data.width &&
		point.y >= data.y &&
		point.y <= data.y + data.height
	);
}

function deckTitle(registry: OpenSlideDeckRegistry, shape: ShapeData): string {
	const deckId = (shape as Partial<OpenSlideShapeData>).deckId ?? "";
	return registry.getDeck(deckId)?.title ?? deckId;
}

export interface OpenSlideShapeDefinitionOptions {
	registry: OpenSlideDeckRegistry;
	presentCursor: PresentCursor;
	onSetPage: (shapeId: string, page: number) => void;
}

/** open-slide デッキ Shape の定義。 */
export function createOpenSlideShapeDefinition({
	registry,
	presentCursor,
	onSetPage,
}: OpenSlideShapeDefinitionOptions): ShapeDefinition {
	function SimplifiedOpenSlide({ shape }: { shape: ShapeData }) {
		return (
			<div
				style={{
					position: "absolute",
					left: shape.x,
					top: shape.y,
					width: shape.width,
					height: shape.height,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					background: "#ffffff",
					border: "1px solid #d4d4d8",
					color: "#3f3f46",
					fontSize: Math.max(12, shape.width * 0.05),
					fontFamily: "system-ui, sans-serif",
					pointerEvents: "none",
					overflow: "hidden",
				}}
			>
				{deckTitle(registry, shape)}
			</div>
		);
	}

	return {
		render: (shape) => (
			<OpenSlideShapeView
				shape={shape as OpenSlideShapeData}
				registry={registry}
				presentCursor={presentCursor}
				onSetPage={onSetPage}
			/>
		),
		renderForExport: (shape) => (
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					background: "#ffffff",
					border: "1px solid #d4d4d8",
					color: "#3f3f46",
					fontSize: Math.max(12, shape.width * 0.05),
				}}
			>
				{deckTitle(registry, shape)}
			</div>
		),
		getBounds,
		hitTest,
		resize: resizeOpenSlideShape,
		createDefault: ({ id, x, y }) => {
			const deck = registry.getDecks()[0];
			const shape = createOpenSlideShapeData({
				id,
				deck: { id: deck?.id ?? "" },
				center: { x, y },
				pageCount: deck ? registry.getPageCount(deck.id) : undefined,
			});
			// createDefault は左上基準で呼ばれるので中心合わせを戻す。
			return { ...shape, x, y };
		},
		renderTarget: "html",
		minSize: { width: OPEN_SLIDE_MIN_WIDTH, height: OPEN_SLIDE_MIN_WIDTH / OPEN_SLIDE_ASPECT },
		simplifiedComponent: SimplifiedOpenSlide,
		serializeForAi: (shape) => ({
			deck: deckTitle(registry, shape),
			page: (shape as Partial<OpenSlideShapeData>).page ?? 0,
		}),
	};
}
