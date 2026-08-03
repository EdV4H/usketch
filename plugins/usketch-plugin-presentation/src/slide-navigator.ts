import type { BoardStore, BoundingBox, ShapeData } from "@edv4h/usketch-shared";

/** ある shape をスライドとして扱うかどうかを判定する述語。 */
export type IsSlide = (shape: ShapeData) => boolean;

/** 既定のスライド判定: Frame シェイプをスライドとして扱う。 */
const defaultIsSlide: IsSlide = (s) => s.type === "frame";

export interface SlideNavigatorOptions {
	/**
	 * どの shape を「スライド」として扱うかの述語。
	 * 省略時は Frame シェイプ（`type === "frame"`）。ホスト側で
	 * 「スライド指定した Frame だけ」や専用の画角 shape を対象にしたいときに差し替える。
	 */
	isSlide?: IsSlide;
}

/**
 * スライド（既定では Frame シェイプ）を表示順（zIndex 昇順）で並べたものを
 * 「スライド」と解釈する。新しいドメイン概念を持ち込まないのがポイント。
 * `options.isSlide` でスライドとして扱う shape を差し替えられる。
 */
export class SlideNavigator {
	private currentIndex = 0;
	/**
	 * 現在選択中のスライド（Frame）の shape id。
	 * 並び替えや追加で index だけ覚えていると指す Frame が変わってしまうので、
	 * 可能な限り id で追跡し、mutation 後に新しい slides 配列から index を再導出する。
	 */
	private currentFrameId: string | null = null;
	private readonly changeListeners = new Set<(index: number) => void>();
	private readonly unsubscribeStore: () => void;
	private getViewportSize: () => { width: number; height: number };
	/** 現在 Frame として扱っている shape id。`shape:removed` で id が消えたかどうかの判定に使う。 */
	private frameIds: Set<string>;
	/** スライド判定述語（省略時は Frame）。 */
	private readonly isSlide: IsSlide;

	constructor(
		private readonly store: BoardStore,
		getViewportSize: () => { width: number; height: number },
		options: SlideNavigatorOptions = {},
	) {
		this.isSlide = options.isSlide ?? defaultIsSlide;
		this.getViewportSize = getViewportSize;
		const initialSlides = this.getSlides();
		this.frameIds = new Set(initialSlides.map((s) => s.id));
		this.currentFrameId = initialSlides[0]?.id ?? null;
		// スライド構成（＝フレーム追加/削除/並び替え）に関係するミューテーションだけを聞く。
		// store.subscribe は viewport 変更でも発火するので、それを契機にリスナーを呼ぶと
		// gotoIndex 中の fitToBounds で余計な onChange が一度走ってしまう。
		this.unsubscribeStore = store.onMutation((event) => {
			if (!this.isSlideRelatedMutation(event.type, event.payload)) return;
			// frame セットと現在の index を再構築する（並び替え時も currentFrameId を基準に再導出）
			const slides = this.getSlides();
			this.frameIds = new Set(slides.map((s) => s.id));
			if (slides.length === 0) {
				this.currentFrameId = null;
				this.currentIndex = 0;
			} else {
				// id が残っていればその新 index に、無ければ旧 index を slides 数に clamp
				const foundIdx = this.currentFrameId
					? slides.findIndex((s) => s.id === this.currentFrameId)
					: -1;
				if (foundIdx >= 0) {
					this.currentIndex = foundIdx;
				} else {
					this.currentIndex = Math.min(this.currentIndex, slides.length - 1);
					this.currentFrameId = slides[this.currentIndex]?.id ?? null;
				}
			}
			for (const l of this.changeListeners) l(this.currentIndex);
		});
	}

	/**
	 * mutation がスライド一覧に影響するか判定する。
	 * - shape:added / shape:updated → 対象 shape がスライドのときだけ影響（非スライドのドラッグ等は無視）
	 * - shape:removed → 削除された id が現在のスライドセットにあったときだけ影響
	 * - shapes:z-index-initialized → 常に影響
	 *
	 * NOTE: `shape:updated` は「スライド化フラグの付け外し」でも発火するため、
	 * 現在スライドセットに含まれる id なら（今は非スライドでも）影響ありとして通す。
	 */
	private isSlideRelatedMutation(type: string, payload: unknown): boolean {
		if (type === "shapes:z-index-initialized") return true;
		const id = (payload as { id?: unknown } | null | undefined)?.id;
		if (type === "shape:removed") {
			if (typeof id !== "string") return true;
			return this.frameIds.has(id);
		}
		if (type !== "shape:added" && type !== "shape:updated") return false;
		if (typeof id !== "string") {
			// id が取れない想定外形式は安全側で通す
			return true;
		}
		// 既にスライドだった shape の更新（＝スライド解除も含む）は影響あり。
		if (this.frameIds.has(id)) return true;
		const shape = this.store.getShape(id);
		return shape ? this.isSlide(shape) : false;
	}

	getSlides(): ShapeData[] {
		return this.store.getShapesSorted().filter((s) => this.isSlide(s));
	}

	getCurrentIndex(): number {
		return this.currentIndex;
	}

	/** 現在スライドの world 矩形 (回転無視の AABB)。スライドが無ければ null。 */
	getCurrentBounds(): BoundingBox | null {
		const slides = this.getSlides();
		const s = slides[this.currentIndex];
		return s ? { x: s.x, y: s.y, width: s.width, height: s.height } : null;
	}

	/** 内部の store。ホスト側 overlay が viewport 購読/取得に使う。 */
	getStore(): BoardStore {
		return this.store;
	}

	gotoIndex(index: number): void {
		const slides = this.getSlides();
		if (slides.length === 0) return;
		const clamped = Math.max(0, Math.min(index, slides.length - 1));
		// currentIndex / currentFrameId を fitToBounds より先に更新して、後続の通知が
		// 「古い index で発火し、その直後に新しい index で発火する」という
		// 二段階発火を避ける。
		this.currentIndex = clamped;
		const target = slides[clamped];
		this.currentFrameId = target?.id ?? null;
		if (target) {
			const bounds: BoundingBox = {
				x: target.x,
				y: target.y,
				width: target.width,
				height: target.height,
			};
			this.store.fitToBounds(bounds, this.getViewportSize());
		}
		for (const l of this.changeListeners) l(clamped);
	}

	next(): void {
		this.gotoIndex(this.currentIndex + 1);
	}

	prev(): void {
		this.gotoIndex(this.currentIndex - 1);
	}

	first(): void {
		this.gotoIndex(0);
	}

	last(): void {
		this.gotoIndex(this.getSlides().length - 1);
	}

	onChange(listener: (index: number) => void): () => void {
		this.changeListeners.add(listener);
		return () => {
			this.changeListeners.delete(listener);
		};
	}

	destroy(): void {
		this.unsubscribeStore();
		this.changeListeners.clear();
	}
}
