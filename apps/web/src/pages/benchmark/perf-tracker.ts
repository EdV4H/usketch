export interface PerfStats {
	avgFps: number;
	avgFrameTime: number;
	p99FrameTime: number;
	minFps: number;
	frameCount: number;
}

export class PerfTracker {
	private frameTimes: number[] = [];

	recordFrame(dt: number): void {
		this.frameTimes.push(dt);
	}

	getStats(): PerfStats {
		const times = this.frameTimes;
		if (times.length === 0) {
			return { avgFps: 0, avgFrameTime: 0, p99FrameTime: 0, minFps: 0, frameCount: 0 };
		}

		const sum = times.reduce((a, b) => a + b, 0);
		const avgFrameTime = sum / times.length;
		const avgFps = 1000 / avgFrameTime;

		const sorted = [...times].sort((a, b) => a - b);
		const p99Index = Math.min(Math.floor(sorted.length * 0.99), sorted.length - 1);
		const p99FrameTime = sorted[p99Index];

		const maxFrameTime = sorted[sorted.length - 1];
		const minFps = 1000 / maxFrameTime;

		return {
			avgFps: Math.round(avgFps * 10) / 10,
			avgFrameTime: Math.round(avgFrameTime * 100) / 100,
			p99FrameTime: Math.round(p99FrameTime * 100) / 100,
			minFps: Math.round(minFps * 10) / 10,
			frameCount: times.length,
		};
	}

	/** Get current live FPS (last 10 frames). */
	getLiveFps(): number {
		const recent = this.frameTimes.slice(-10);
		if (recent.length === 0) return 0;
		const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
		return Math.round(1000 / avg);
	}

	/** Get current live frame time (last frame). */
	getLiveFrameTime(): number {
		if (this.frameTimes.length === 0) return 0;
		return Math.round(this.frameTimes[this.frameTimes.length - 1] * 100) / 100;
	}

	reset(): void {
		this.frameTimes = [];
	}
}
