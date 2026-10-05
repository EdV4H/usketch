import { describe, expect, it } from "vitest";
import type { Camera } from "../mode7-camera.js";
import {
	drawDistanceClip,
	drawDistanceOverscanPx,
	fogBackground,
	fogOpacity,
	rgba,
	skyBackground,
	tiltTransform,
} from "../mode7-transform.js";

const CAM: Camera = { pitch: 55, yaw: 12, fov: 600, horizon: 0.45 };

describe("tiltTransform", () => {
	it("perspective→rotateX→rotateZ の順で transform を組む", () => {
		expect(tiltTransform(CAM).transform).toBe("perspective(600px) rotateX(55deg) rotateZ(12deg)");
	});
	it("transform-origin は横中央・horizon 割合", () => {
		expect(tiltTransform(CAM).transformOrigin).toBe("50% 45%");
	});
	it("値は丸められる", () => {
		const t = tiltTransform({ pitch: 55.00001, yaw: 0, fov: 600, horizon: 0.333 });
		expect(t.transform).toBe("perspective(600px) rotateX(55deg) rotateZ(0deg)");
		expect(t.transformOrigin).toBe("50% 33.3%");
	});
});

describe("rgba", () => {
	it("#rrggbb を rgba に変換", () => {
		expect(rgba("#3366cc", 0.5)).toBe("rgba(51, 102, 204, 0.5)");
	});
	it("#rgb を展開", () => {
		expect(rgba("#08f", 1)).toBe("rgba(0, 136, 255, 1)");
	});
	it("alpha はクランプ", () => {
		expect(rgba("#000000", 5)).toBe("rgba(0, 0, 0, 1)");
		expect(rgba("#000000", -1)).toBe("rgba(0, 0, 0, 0)");
	});
	it("非 hex は color-mix にフォールバック", () => {
		expect(rgba("skyblue", 0.4)).toBe("color-mix(in srgb, skyblue 40%, transparent)");
	});
});

describe("skyBackground", () => {
	it("空色→横方向の縦グラデ、horizon を跨いでソフトに透明へ抜ける", () => {
		// horizon 0.4 → h=40, mid=min(20,32)=20, hazeTop=32, clearBottom=48
		const g = skyBackground("#88bbff", 0.4);
		expect(g).toBe(
			"linear-gradient(to bottom, #88bbff 0%, #88bbff 20%, rgba(136, 187, 255, 0.35) 32%, transparent 48%)",
		);
	});
});

describe("fogBackground / fogOpacity", () => {
	it("horizon の少し上からフェードインし horizon で濃く、下端(カメラ)で晴れる", () => {
		// horizon 0.45 → h=45, fadeInTop=37
		const g = fogBackground("#ffffff", 0.6, 0.45);
		expect(g).toBe(
			"linear-gradient(to bottom, transparent 37%, rgba(255, 255, 255, 0.6) 45%, transparent 100%)",
		);
	});
	it("density=0 は不透明度 0（描かない）", () => {
		expect(fogOpacity(0)).toBe(0);
		expect(fogOpacity(2)).toBe(1);
	});
});

describe("drawDistanceClip (canvas units)", () => {
	it("距離 0 / 不正値は auto = 箱クリップ inset(0)", () => {
		expect(drawDistanceClip(0, 1, 784)).toBe("inset(0% 0% 0% 0%)");
		expect(drawDistanceClip(-5, 1, 784)).toBe("inset(0% 0% 0% 0%)");
		expect(drawDistanceClip(400, 0, 784)).toBe("inset(0% 0% 0% 0%)");
		expect(drawDistanceClip(400, 1, 0)).toBe("inset(0% 0% 0% 0%)");
	});
	it("箱内の距離は正 inset（手前だけ残す）", () => {
		// bandPx = 400 → insetTop = (1 - 400/800)*100 = 50
		expect(drawDistanceClip(400, 1, 800)).toBe("inset(50% 0% 0% 0%)");
	});
	it("箱を超える距離は全方向へ負 inset（地面が横にも広がる）", () => {
		// bandPx = 1568 > 784 → over = 1568 - 784 = 784, 全辺 -784px
		expect(drawDistanceClip(1568, 1, 784)).toBe("inset(-784px -784px -784px -784px)");
	});
	it("ズームで px 換算が変わる", () => {
		// distance 400 canvas, zoom 0.5 → bandPx 200 → insetTop (1-200/800)*100 = 75
		expect(drawDistanceClip(400, 0.5, 800)).toBe("inset(75% 0% 0% 0%)");
	});
});

describe("drawDistanceOverscanPx", () => {
	it("箱内 / auto / 不正値は 0（延長不要）", () => {
		expect(drawDistanceOverscanPx(0, 1, 800)).toBe(0);
		expect(drawDistanceOverscanPx(400, 1, 800)).toBe(0); // bandPx 400 < 800
		expect(drawDistanceOverscanPx(400, 0, 800)).toBe(0);
	});
	it("箱超え分の px を返す（grid をそこまで延長）", () => {
		// bandPx 1200 - 800 = 400
		expect(drawDistanceOverscanPx(1200, 1, 800)).toBe(400);
		// zoom 0.5: bandPx 500 - 400 = 100
		expect(drawDistanceOverscanPx(1000, 0.5, 400)).toBe(100);
	});
});
