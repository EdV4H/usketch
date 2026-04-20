import type { BoardStore, BoundingBox, ShapeData } from "@edv4h/usketch-shared";

/**
 * Frame シェイプを表示順（zIndex 昇順）で並べたものを「スライド」と解釈する。
 * 新しいドメイン概念を Frame に持ち込まないのがポイント。
 */
export class SlideNavigator {
	private currentIndex = 0;
	private readonly changeListeners = new Set<(index: number) => void>();
	private readonly unsubscribeStore: () => void;
	private getViewportSize: () => { width: number; height: number };

	constructor(
		private readonly store: BoardStore,
		getViewportSize: () => { width: number; height: number },
	) {
		this.getViewportSize = getViewportSize;
		// スライド構成（＝フレーム追加/削除/並び替え）に関係するミューテーションだけを聞く。
		// store.subscribe は viewport 変更でも発火するので、それを契機にリスナーを呼ぶと
		// gotoIndex 中の fitToBounds で余計な onChange が一度走ってしまう。
		this.unsubscribeStore = store.onMutation((event) => {
			if (
				event.type === "shape:added" ||
				event.type === "shape:removed" ||
				event.type === "shape:updated" ||
				event.type === "shapes:z-index-initialized"
			) {
				for (const l of this.changeListeners) l(this.currentIndex);
			}
		});
	}

	getSlides(): ShapeData[] {
		return this.store.getShapesSorted().filter((s) => s.type === "frame");
	}

	getCurrentIndex(): number {
		return this.currentIndex;
	}

	gotoIndex(index: number): void {
		const slides = this.getSlides();
		if (slides.length === 0) return;
		const clamped = Math.max(0, Math.min(index, slides.length - 1));
		// currentIndex を fitToBounds より先に更新して、後続の通知が
		// 「古い index で発火し、その直後に新しい index で発火する」という
		// 二段階発火を避ける。
		this.currentIndex = clamped;
		const target = slides[clamped];
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
