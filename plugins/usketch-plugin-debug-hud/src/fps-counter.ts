const HISTORY_SIZE = 60;

export class FpsCounter {
	private frameCount = 0;
	private lastTime = 0;
	private currentFps = 0;
	private rafId = 0;
	private listeners = new Set<() => void>();
	private historyBuffer: number[] = [];

	start(): void {
		this.lastTime = performance.now();
		this.frameCount = 0;
		this.tick();
	}

	stop(): void {
		cancelAnimationFrame(this.rafId);
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	getSnapshot(): number {
		return this.currentFps;
	}

	getHistory(): readonly number[] {
		return this.historyBuffer;
	}

	private tick = (): void => {
		this.rafId = requestAnimationFrame(this.tick);
		this.frameCount++;
		const now = performance.now();
		const elapsed = now - this.lastTime;
		if (elapsed >= 1000) {
			this.currentFps = Math.round((this.frameCount * 1000) / elapsed);
			this.frameCount = 0;
			this.lastTime = now;
			this.historyBuffer.push(this.currentFps);
			if (this.historyBuffer.length > HISTORY_SIZE) {
				this.historyBuffer.shift();
			}
			for (const listener of this.listeners) {
				listener();
			}
		}
	};
}
