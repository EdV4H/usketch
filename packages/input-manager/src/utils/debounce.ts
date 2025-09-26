/**
 * デバウンス関数を作成する
 * @param func 実行する関数
 * @param wait 待機時間（ミリ秒）
 * @param immediate 即座に実行するかどうか
 */
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number,
	immediate = false
): (...args: Parameters<T>) => void {
	let timeout: NodeJS.Timeout | null = null;

	return function (this: any, ...args: Parameters<T>) {
		const context = this;
		const callNow = immediate && !timeout;

		const later = () => {
			timeout = null;
			if (!immediate) {
				func.apply(context, args);
			}
		};

		if (timeout) {
			clearTimeout(timeout);
		}

		timeout = setTimeout(later, wait);

		if (callNow) {
			func.apply(context, args);
		}
	};
}

/**
 * スロットル関数を作成する
 * @param func 実行する関数
 * @param limit 実行間隔の最小時間（ミリ秒）
 */
export function throttle<T extends (...args: any[]) => any>(
	func: T,
	limit: number
): (...args: Parameters<T>) => ReturnType<T> {
	let inThrottle = false;
	let lastFunc: NodeJS.Timeout | null = null;
	let lastRan = 0;

	let lastResult: ReturnType<T>;

	return function (this: any, ...args: Parameters<T>): ReturnType<T> {
		const context = this;

		if (!inThrottle) {
			lastResult = func.apply(context, args);
			lastRan = Date.now();
			inThrottle = true;
		} else {
			if (lastFunc) {
				clearTimeout(lastFunc);
			}

			lastFunc = setTimeout(() => {
				if (Date.now() - lastRan >= limit) {
					lastResult = func.apply(context, args);
					lastRan = Date.now();
				}
			}, Math.max(limit - (Date.now() - lastRan), 0));
		}

		return lastResult;
	};
}

/**
 * ラフ関数（RequestAnimationFrame版のデバウンス）
 * @param func 実行する関数
 */
export function raf<T extends (...args: any[]) => any>(
	func: T
): (...args: Parameters<T>) => void {
	let rafId: number | null = null;
	let lastArgs: Parameters<T> | null = null;

	return function (this: any, ...args: Parameters<T>) {
		const context = this;
		lastArgs = args;

		if (rafId === null) {
			rafId = requestAnimationFrame(() => {
				func.apply(context, lastArgs!);
				rafId = null;
				lastArgs = null;
			});
		}
	};
}