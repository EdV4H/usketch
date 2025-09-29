/**
 * Create a debounce function
 * @param func Function to execute
 * @param wait Wait time in milliseconds
 * @param immediate Whether to execute immediately
 */
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number,
	immediate = false,
): (...args: Parameters<T>) => void {
	let timeout: number | null = null;

	return function (this: any, ...args: Parameters<T>) {
		const callNow = immediate && !timeout;

		const later = () => {
			timeout = null;
			if (!immediate) {
				func.apply(this, args);
			}
		};

		if (timeout) {
			clearTimeout(timeout);
		}

		timeout = setTimeout(later, wait);

		if (callNow) {
			func.apply(this, args);
		}
	};
}

/**
 * Create a throttle function
 * @param func Function to execute
 * @param limit Minimum time between executions in milliseconds
 */
export function throttle<T extends (...args: any[]) => any>(
	func: T,
	limit: number,
): (...args: Parameters<T>) => ReturnType<T> {
	let inThrottle = false;
	let lastFunc: number | null = null;
	let lastRan = 0;

	let lastResult: ReturnType<T>;

	return function (this: any, ...args: Parameters<T>): ReturnType<T> {
		if (!inThrottle) {
			lastResult = func.apply(this, args);
			lastRan = Date.now();
			inThrottle = true;
		} else {
			if (lastFunc) {
				clearTimeout(lastFunc);
			}

			lastFunc = setTimeout(
				() => {
					if (Date.now() - lastRan >= limit) {
						lastResult = func.apply(this, args);
						lastRan = Date.now();
					}
				},
				Math.max(limit - (Date.now() - lastRan), 0),
			);
		}

		return lastResult;
	};
}

/**
 * ラフ関数（RequestAnimationFrame版のデバウンス）
 * @param func 実行する関数
 */
export function raf<T extends (...args: any[]) => any>(func: T): (...args: Parameters<T>) => void {
	let rafId: number | null = null;
	let lastArgs: Parameters<T> | null = null;

	return function (this: any, ...args: Parameters<T>) {
		lastArgs = args;

		if (rafId === null) {
			rafId = requestAnimationFrame(() => {
				func.apply(this, lastArgs!);
				rafId = null;
				lastArgs = null;
			});
		}
	};
}
