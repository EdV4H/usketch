import { vi } from "vitest";

// グローバルなDOM APIのセットアップ
globalThis.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 0) as any);
globalThis.cancelAnimationFrame = vi.fn((id) => clearTimeout(id));

// PerformanceのモックがHappy DOMになければ追加
if (!globalThis.performance) {
	globalThis.performance = {
		now: () => Date.now(),
	} as any;
}