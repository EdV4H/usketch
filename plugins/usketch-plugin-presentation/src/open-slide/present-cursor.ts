/** 発表中に画角へ入っているスライドと、そのスライド内のステップ位置。 */
export interface PresentPosition {
	shapeId: string;
	step: number;
}

/**
 * 発表中の現在位置を Shape の描画へ流すための購読可能な値。発表していないときは null。
 * `get` は値が変わらない限り同じ参照を返す（useSyncExternalStore 用）。
 */
export interface PresentCursor {
	get(): PresentPosition | null;
	subscribe(listener: () => void): () => void;
}

/** 手動で値を流し込む PresentCursor。plugin が navigator とモードの変化から set する。 */
export class MutablePresentCursor implements PresentCursor {
	private value: PresentPosition | null = null;
	private readonly listeners = new Set<() => void>();

	get = (): PresentPosition | null => this.value;

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	set(next: PresentPosition | null): void {
		const prev = this.value;
		if (prev === next) return;
		if (prev && next && prev.shapeId === next.shapeId && prev.step === next.step) return;
		this.value = next;
		for (const l of this.listeners) l();
	}
}
