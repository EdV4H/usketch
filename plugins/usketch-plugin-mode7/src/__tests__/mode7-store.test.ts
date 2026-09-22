import { describe, expect, it } from "vitest";
import { createMode7Store } from "../mode7-store.js";

describe("createMode7Store — capture frame", () => {
	it("既定は非表示・矩形なし", () => {
		const s = createMode7Store();
		expect(s.getState().showCaptureFrame).toBe(false);
		expect(s.getState().captureRect).toBeNull();
	});

	it("init.showCaptureFrame で初期表示を上書きできる", () => {
		const s = createMode7Store({ showCaptureFrame: true });
		expect(s.getState().showCaptureFrame).toBe(true);
	});

	it("setCaptureFrame / toggleCaptureFrame で表示を切り替える", () => {
		const s = createMode7Store();
		s.setCaptureFrame(true);
		expect(s.getState().showCaptureFrame).toBe(true);
		s.toggleCaptureFrame();
		expect(s.getState().showCaptureFrame).toBe(false);
	});

	it("setCaptureFrame は同値なら通知しない", () => {
		const s = createMode7Store();
		let n = 0;
		s.subscribe(() => n++);
		s.setCaptureFrame(false); // 既に false
		expect(n).toBe(0);
		s.setCaptureFrame(true);
		expect(n).toBe(1);
	});

	it("setCaptureRect で世界矩形を保持し、null でクリアできる", () => {
		const s = createMode7Store();
		const rect = { x: -100, y: -50, width: 800, height: 600 };
		s.setCaptureRect(rect);
		expect(s.getState().captureRect).toEqual(rect);
		s.setCaptureRect(null);
		expect(s.getState().captureRect).toBeNull();
	});
});

describe("createMode7Store — draw distance", () => {
	it("既定は 1（full）", () => {
		expect(createMode7Store().getState().drawDistance).toBe(1);
	});
	it("init.drawDistance はクランプして反映", () => {
		expect(createMode7Store({ drawDistance: 0.4 }).getState().drawDistance).toBe(0.4);
		expect(createMode7Store({ drawDistance: 5 }).getState().drawDistance).toBe(1);
		expect(createMode7Store({ drawDistance: -2 }).getState().drawDistance).toBe(0);
	});
	it("setDrawDistance はクランプし、同値なら通知しない", () => {
		const s = createMode7Store();
		let n = 0;
		s.subscribe(() => n++);
		s.setDrawDistance(2); // クランプで 1 = 既定と同値
		expect(s.getState().drawDistance).toBe(1);
		expect(n).toBe(0);
		s.setDrawDistance(0.6);
		expect(s.getState().drawDistance).toBe(0.6);
		expect(n).toBe(1);
	});
});
