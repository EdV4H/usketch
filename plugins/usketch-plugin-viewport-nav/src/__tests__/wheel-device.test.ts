import { describe, expect, it } from "vitest";
import { createWheelDeviceDetector, guessWheelDevice } from "../wheel-device.js";

describe("guessWheelDevice", () => {
	it("行/ページ単位（Firefox のマウスホイール）はマウス", () => {
		expect(guessWheelDevice({ deltaX: 0, deltaY: 120, deltaMode: 1 })).toBe("mouse");
		expect(guessWheelDevice({ deltaX: 0, deltaY: 800, deltaMode: 2 })).toBe("mouse");
	});

	it("縦横同時に動くのはトラックパッド", () => {
		expect(guessWheelDevice({ deltaX: 3, deltaY: 5, deltaMode: 0 })).toBe("trackpad");
	});

	it("wheelDelta = -3 × delta はトラックパッド、±120 刻みはマウス（Chrome / Safari）", () => {
		expect(guessWheelDevice({ deltaX: 0, deltaY: 4, wheelDeltaY: -12 })).toBe("trackpad");
		// wheelDelta は整数に丸められるので小数の delta でも一致とみなす
		expect(guessWheelDevice({ deltaX: 0, deltaY: 2.5, wheelDeltaY: -7 })).toBe("trackpad");
		expect(guessWheelDevice({ deltaX: 0, deltaY: 100, wheelDeltaY: -120 })).toBe("mouse");
		expect(guessWheelDevice({ deltaX: 0, deltaY: -100, wheelDeltaY: 120 })).toBe("mouse");
	});

	it("横だけのスクロールは wheelDeltaX で判定する", () => {
		expect(guessWheelDevice({ deltaX: 6, deltaY: 0, wheelDeltaX: -18 })).toBe("trackpad");
		expect(guessWheelDevice({ deltaX: 100, deltaY: 0, wheelDeltaX: -120 })).toBe("mouse");
	});

	it("wheelDelta が無ければ小数の delta をトラックパッドとみなし、整数は分からない", () => {
		expect(guessWheelDevice({ deltaX: 0, deltaY: 1.75, ctrlKey: true })).toBe("trackpad");
		expect(guessWheelDevice({ deltaX: 0, deltaY: 100 })).toBeNull();
	});
});

describe("createWheelDeviceDetector", () => {
	function detector(initial?: "mouse" | "trackpad") {
		let t = 0;
		const d = createWheelDeviceDetector({ now: () => t, streamGapMs: 100, initial });
		return {
			d,
			at: (ms: number) => {
				t = ms;
			},
		};
	}

	it("手がかりが無ければ initial（既定はマウス）", () => {
		const { d } = detector();
		expect(d.last()).toBeNull();
		expect(d.classify({ deltaX: 0, deltaY: 100 })).toBe("mouse");
		expect(d.last()).toBe("mouse");
	});

	it("一続きの操作の途中では判定を変えない", () => {
		const { d, at } = detector();
		at(0);
		expect(d.classify({ deltaX: 0, deltaY: 4, wheelDeltaY: -12 })).toBe("trackpad");
		at(16);
		// 慣性の途中で ±120 に見える値が来てもトラックパッドのまま
		expect(d.classify({ deltaX: 0, deltaY: 40, wheelDeltaY: -120 })).toBe("trackpad");
		at(500);
		expect(d.classify({ deltaX: 0, deltaY: 100, wheelDeltaY: -120 })).toBe("mouse");
	});

	it("手がかりの無いイベントは直前の判定を引き継ぎ、後から来た手がかりで決める", () => {
		const { d, at } = detector();
		at(0);
		d.classify({ deltaX: 0, deltaY: 4, wheelDeltaY: -12 });
		at(1000);
		expect(d.classify({ deltaX: 0, deltaY: 10 })).toBe("trackpad");
		at(1010);
		expect(d.classify({ deltaX: 0, deltaY: 3, deltaMode: 1 })).toBe("mouse");
	});

	it("reset で最初の状態に戻る", () => {
		const { d } = detector("trackpad");
		d.classify({ deltaX: 0, deltaY: 3, deltaMode: 1 });
		d.reset();
		expect(d.last()).toBeNull();
		expect(d.classify({ deltaX: 0, deltaY: 100 })).toBe("trackpad");
	});
});
