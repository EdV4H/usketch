/**
 * いま中身を編集しているデッキ Shape の id。ボードには保存せず、この画面だけの状態。
 * 編集できるのは一度に 1 つのデッキだけ。
 */
export class OpenSlideEditState {
	private editingId: string | null = null;
	private readonly listeners = new Set<() => void>();

	get = (): string | null => this.editingId;

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	begin(shapeId: string): void {
		this.set(shapeId);
	}

	/** `shapeId` を渡すと、そのデッキを編集しているときだけ終える。 */
	end(shapeId?: string): void {
		if (shapeId !== undefined && this.editingId !== shapeId) return;
		this.set(null);
	}

	private set(next: string | null): void {
		if (next === this.editingId) return;
		this.editingId = next;
		for (const l of this.listeners) l();
	}
}
