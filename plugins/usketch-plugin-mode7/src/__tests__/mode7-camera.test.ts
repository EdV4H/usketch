import { describe, expect, it } from "vitest";
import {
	adjustCamera,
	CAMERA_LIMITS,
	type Camera,
	clampCamera,
	DEFAULT_CAMERA,
	updateCamera,
	wrapDeg,
} from "../mode7-camera.js";

describe("wrapDeg", () => {
	it("(-180,180] に正規化する", () => {
		expect(wrapDeg(0)).toBe(0);
		expect(wrapDeg(190)).toBe(-170);
		expect(wrapDeg(-190)).toBe(170);
		expect(wrapDeg(360)).toBe(0);
		expect(wrapDeg(540)).toBe(180);
	});
	it("非有限は 0", () => {
		expect(wrapDeg(Number.NaN)).toBe(0);
	});
});

describe("clampCamera", () => {
	it("pitch/fov/horizon を範囲内にクランプ", () => {
		const c = clampCamera({ pitch: 200, yaw: 30, fov: 10, horizon: 5 });
		expect(c.pitch).toBe(CAMERA_LIMITS.pitch.max);
		expect(c.fov).toBe(CAMERA_LIMITS.fov.min);
		expect(c.horizon).toBe(CAMERA_LIMITS.horizon.max);
		expect(c.yaw).toBe(30);
	});
	it("下限も効く / yaw は wrap", () => {
		const c = clampCamera({ pitch: -10, yaw: 270, fov: 99999, horizon: -1 });
		expect(c.pitch).toBe(CAMERA_LIMITS.pitch.min);
		expect(c.fov).toBe(CAMERA_LIMITS.fov.max);
		expect(c.horizon).toBe(CAMERA_LIMITS.horizon.min);
		expect(c.yaw).toBe(-90);
	});
	it("非有限は下限へフォールバック", () => {
		const c = clampCamera({ pitch: Number.NaN, yaw: 0, fov: Number.NaN, horizon: Number.NaN });
		expect(c.pitch).toBe(CAMERA_LIMITS.pitch.min);
		expect(c.fov).toBe(CAMERA_LIMITS.fov.min);
		expect(c.horizon).toBe(CAMERA_LIMITS.horizon.min);
	});
});

describe("updateCamera", () => {
	it("部分更新して再クランプ、他フィールドは保持", () => {
		const c = updateCamera(DEFAULT_CAMERA, { pitch: 70 });
		expect(c.pitch).toBe(70);
		expect(c.yaw).toBe(DEFAULT_CAMERA.yaw);
		expect(c.fov).toBe(DEFAULT_CAMERA.fov);
	});
	it("範囲外の部分更新はクランプ", () => {
		expect(updateCamera(DEFAULT_CAMERA, { pitch: 999 }).pitch).toBe(CAMERA_LIMITS.pitch.max);
	});
});

describe("adjustCamera", () => {
	it("デルタを加算して再クランプ", () => {
		const base: Camera = { pitch: 50, yaw: 0, fov: 600, horizon: 0.45 };
		const c = adjustCamera(base, { pitch: 10, yaw: -20 });
		expect(c.pitch).toBe(60);
		expect(c.yaw).toBe(-20);
	});
	it("上限を超えないよう加算をクランプ", () => {
		const base: Camera = { pitch: 80, yaw: 0, fov: 600, horizon: 0.45 };
		expect(adjustCamera(base, { pitch: 20 }).pitch).toBe(CAMERA_LIMITS.pitch.max);
	});
	it("yaw の加算は wrap する", () => {
		const base: Camera = { pitch: 50, yaw: 170, fov: 600, horizon: 0.45 };
		expect(adjustCamera(base, { yaw: 30 }).yaw).toBe(-160);
	});
});
