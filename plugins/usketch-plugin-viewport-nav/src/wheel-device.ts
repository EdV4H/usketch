/**
 * ホイールイベントがマウスホイールから来たのか、トラックパッド（2 本指スクロール / ピンチ）から
 * 来たのかを推定する。ブラウザは発生元デバイスを教えてくれないので、`deltaMode` や
 * 非標準の `wheelDeltaY` などの手がかりから推定する（完全ではないので HUD で手動指定もできる）。
 */

/** ホイール入力の発生元デバイス。 */
export type WheelDevice = "mouse" | "trackpad";

/** 推定に使うホイールイベントの値（`CanvasWheelEvent` の部分集合）。 */
export interface WheelSample {
	deltaX: number;
	deltaY: number;
	/** DOM の `WheelEvent.deltaMode`（0=pixel, 1=line, 2=page）。 */
	deltaMode?: number;
	/** 非標準の `WheelEvent.wheelDeltaX`（Chrome / Safari / Edge）。 */
	wheelDeltaX?: number;
	/** 非標準の `WheelEvent.wheelDeltaY`（Chrome / Safari / Edge）。 */
	wheelDeltaY?: number;
	ctrlKey?: boolean;
	shiftKey?: boolean;
}

/** `wheelDelta ≈ -3 × delta` を判定するときの許容誤差（wheelDelta は整数に丸められる）。 */
const WHEEL_DELTA_TOLERANCE = 1;

function matchesPixelDevice(wheelDelta: number | undefined, delta: number): boolean | null {
	if (typeof wheelDelta !== "number" || wheelDelta === 0 || delta === 0) return null;
	return Math.abs(wheelDelta + 3 * delta) <= WHEEL_DELTA_TOLERANCE;
}

/**
 * 1 イベントだけを見てデバイスを推定する。手がかりが無いときは `null`。
 *
 * 1. `deltaMode` が行/ページ単位 → マウス（Firefox のマウスホイール）。
 * 2. 縦横の両方に動いている → トラックパッド（マウスホイールは 1 軸しか出さない）。
 * 3. `wheelDeltaY`（無ければ `wheelDeltaX`）がある → `-3 × delta` に一致すればトラックパッド、
 *    それ以外（±120 刻みなど）はマウス（Chrome / Safari / Edge）。
 * 4. delta が小数 → トラックパッド（ピンチや慣性スクロールは細かい値を出す）。
 */
export function guessWheelDevice(sample: WheelSample): WheelDevice | null {
	if (sample.deltaMode === 1 || sample.deltaMode === 2) return "mouse";
	if (sample.deltaX !== 0 && sample.deltaY !== 0) return "trackpad";

	const byY = matchesPixelDevice(sample.wheelDeltaY, sample.deltaY);
	if (byY !== null) return byY ? "trackpad" : "mouse";
	const byX = matchesPixelDevice(sample.wheelDeltaX, sample.deltaX);
	if (byX !== null) return byX ? "trackpad" : "mouse";

	if (!Number.isInteger(sample.deltaY) || !Number.isInteger(sample.deltaX)) return "trackpad";
	return null;
}

export interface WheelDeviceDetectorOptions {
	/**
	 * この時間（ms）以内に続くイベントは同じ操作（1 回のスクロールやピンチ）とみなし、
	 * 途中でデバイスの判定を変えない。既定 250。
	 */
	streamGapMs?: number;
	/** 手がかりが一度も無いときに使うデバイス。既定 `"mouse"`。 */
	initial?: WheelDevice;
	/** 現在時刻（ms）。テスト用。既定 `performance.now()`。 */
	now?: () => number;
}

export interface WheelDeviceDetector {
	/** イベントを 1 つ受け取り、そのイベントのデバイスを返す。 */
	classify(sample: WheelSample): WheelDevice;
	/** 最後に判定したデバイス（まだ 1 度も判定していなければ `null`）。 */
	last(): WheelDevice | null;
	reset(): void;
}

const defaultNow = () =>
	typeof performance !== "undefined" && typeof performance.now === "function"
		? performance.now()
		: Date.now();

/**
 * 連続したイベントの流れごとにデバイスを判定する検出器。
 *
 * 1 回のスクロールやピンチの途中で判定が揺れると速度が急に変わるので、流れの中で一度
 * 手がかりを得たら、その流れが途切れる（`streamGapMs` 空く）まで判定を変えない。
 * 手がかりの無いイベントは直前の判定を引き継ぐ。
 */
export function createWheelDeviceDetector(
	options: WheelDeviceDetectorOptions = {},
): WheelDeviceDetector {
	const gap = options.streamGapMs ?? 250;
	const now = options.now ?? defaultNow;
	const initial = options.initial ?? "mouse";
	let current: WheelDevice = initial;
	let decided = false;
	let confident = false;
	let lastTime = Number.NEGATIVE_INFINITY;

	return {
		classify(sample) {
			const t = now();
			const inStream = t - lastTime <= gap;
			lastTime = t;
			decided = true;
			if (inStream && confident) return current;
			if (!inStream) confident = false;
			const guess = guessWheelDevice(sample);
			if (guess) {
				current = guess;
				confident = true;
			}
			return current;
		},
		last: () => (decided ? current : null),
		reset() {
			current = initial;
			decided = false;
			confident = false;
			lastTime = Number.NEGATIVE_INFINITY;
		},
	};
}
