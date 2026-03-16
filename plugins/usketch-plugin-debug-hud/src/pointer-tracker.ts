import type { Point } from "@edv4h/usketch-shared";

export interface PointerState {
	world: Point;
	screen: Point;
}

const THROTTLE_MS = 100;

export class PointerTracker {
	private state: PointerState = { world: { x: 0, y: 0 }, screen: { x: 0, y: 0 } };
	private listeners = new Set<() => void>();
	private pending = false;
	private timer: ReturnType<typeof setTimeout> | null = null;

	update(world: Point, screen: Point): void {
		this.state = { world, screen };
		if (!this.pending) {
			this.pending = true;
			this.timer = setTimeout(() => {
				this.pending = false;
				this.timer = null;
				for (const listener of this.listeners) {
					listener();
				}
			}, THROTTLE_MS);
		}
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	getSnapshot(): PointerState {
		return this.state;
	}

	dispose(): void {
		if (this.timer) clearTimeout(this.timer);
		this.listeners.clear();
	}
}
