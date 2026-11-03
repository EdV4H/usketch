const HISTORY_SIZE = 60;

/**
 * Measures frames per second with a rAF loop. The loop only runs while someone is
 * subscribed (the FPS readout / graph, which mount only while the HUD is open), so a
 * hidden HUD costs no frame callback. History and the last reading start fresh on
 * every (re)start: the gap while nobody was watching is not a measurement.
 */
export class FpsCounter {
	private frameCount = 0;
	private lastTime = 0;
	private currentFps = 0;
	private rafId: number | null = null;
	private listeners = new Set<() => void>();
	private historyBuffer: number[] = [];

	/** Whether the measuring loop is currently running. */
	isRunning(): boolean {
		return this.rafId !== null;
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		if (this.rafId === null) this.start();
		return () => {
			this.listeners.delete(listener);
			if (this.listeners.size === 0) this.stop();
		};
	}

	getSnapshot(): number {
		return this.currentFps;
	}

	getHistory(): readonly number[] {
		return this.historyBuffer;
	}

	/** Stop measuring and drop all listeners (plugin teardown). */
	dispose(): void {
		this.listeners.clear();
		this.stop();
	}

	private start(): void {
		this.lastTime = performance.now();
		this.frameCount = 0;
		this.currentFps = 0;
		this.historyBuffer = [];
		this.rafId = requestAnimationFrame(this.tick);
	}

	private stop(): void {
		if (this.rafId === null) return;
		cancelAnimationFrame(this.rafId);
		this.rafId = null;
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
