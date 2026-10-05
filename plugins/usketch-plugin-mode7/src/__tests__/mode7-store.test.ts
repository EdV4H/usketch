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

describe("createMode7Store — draw distance (canvas units)", () => {
	it("既定は 1500（地面を少し奥まで敷く）", () => {
		expect(createMode7Store().getState().drawDistance).toBe(1500);
	});
	it("init.drawDistance は反映、負値/不正値は 0", () => {
		expect(createMode7Store({ drawDistance: 3000 }).getState().drawDistance).toBe(3000);
		expect(createMode7Store({ drawDistance: -2 }).getState().drawDistance).toBe(0);
		expect(createMode7Store({ drawDistance: Number.NaN }).getState().drawDistance).toBe(0);
	});
	it("setDrawDistance はクランプし、同値なら通知しない", () => {
		const s = createMode7Store();
		let n = 0;
		s.subscribe(() => n++);
		s.setDrawDistance(1500); // 既定と同値
		expect(n).toBe(0);
		s.setDrawDistance(-1); // クランプで 0（変化）
		expect(s.getState().drawDistance).toBe(0);
		expect(n).toBe(1);
		s.setDrawDistance(2500);
		expect(s.getState().drawDistance).toBe(2500);
		expect(n).toBe(2);
	});
});
