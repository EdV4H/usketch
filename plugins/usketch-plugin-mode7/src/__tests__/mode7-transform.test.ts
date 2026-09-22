import { describe, expect, it } from "vitest";
import type { Camera } from "../mode7-camera.js";
import {
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
	it("空色→横方向の縦グラデ、horizon 以下は透明", () => {
		const g = skyBackground("#88bbff", 0.4);
		expect(g).toContain("linear-gradient(to bottom, #88bbff 0%");
		expect(g).toContain("transparent 40%)");
	});
});

describe("fogBackground / fogOpacity", () => {
	it("horizon で濃く、下端(カメラ)で晴れる", () => {
		const g = fogBackground("#ffffff", 0.6, 0.45);
		expect(g).toBe(
			"linear-gradient(to bottom, transparent 45%, rgba(255, 255, 255, 0.6) 45%, transparent 100%)",
		);
	});
	it("density=0 は不透明度 0（描かない）", () => {
		expect(fogOpacity(0)).toBe(0);
		expect(fogOpacity(2)).toBe(1);
	});
});
