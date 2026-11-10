import { worldToScreen } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import {
	anchorPx,
	easeFocus,
	followCameraHeight,
	followViewport,
	sameViewport,
	smoothingAlpha,
	targetRotation,
} from "../character-camera.js";

describe("followCameraHeight", () => {
	const air = (z: number) => ({ z, airborne: true });
	const ground = (z: number) => ({ z, airborne: false });

	it("follows the ground the character stands on", () => {
		expect(followCameraHeight(null, ground(30), 40)).toBe(30);
		expect(followCameraHeight(10, ground(30), 40)).toBe(30);
	});

	it("holds the take-off height through an ordinary jump", () => {
		let h = followCameraHeight(null, ground(10), 40);
		for (const z of [20, 35, 50, 35, 20]) {
			h = followCameraHeight(h, air(z), 40);
			expect(h).toBe(10);
		}
	});

	it("doesn't dip while jumping over a pit (in the air the ground below is ignored)", () => {
		// Only the body's height counts in the air: the pose carries no ground.
		expect(followCameraHeight(50, air(55), 40)).toBe(50);
	});

	it("rises once a hover climbs past the margin, keeping the body within it", () => {
		expect(followCameraHeight(10, air(80), 40)).toBe(40);
		expect(followCameraHeight(40, air(120), 40)).toBe(80);
	});

	it("comes down with a fall below the take-off height", () => {
		expect(followCameraHeight(50, air(20), 40)).toBe(20);
		expect(followCameraHeight(20, air(-5), 40)).toBe(-5);
	});

	it("starts from the body's height when it begins following mid-air", () => {
		expect(followCameraHeight(null, air(70), 40)).toBe(70);
	});

	it("treats a negative margin as 0 and a non-finite height as the board", () => {
		expect(followCameraHeight(10, air(30), -5)).toBe(30);
		expect(followCameraHeight(10, ground(Number.NaN), 40)).toBe(0);
	});
});

describe("follow camera", () => {
	it("pins the character to its anchor, with and without rotation", () => {
		const anchor = anchorPx({ x: 0.5, y: 0.75 }, { width: 800, height: 600 });
		expect(anchor).toEqual({ x: 400, y: 450 });
		for (const rotation of [0, 37, -120]) {
			const vp = followViewport({ focus: { x: 1234, y: -56 }, rotation }, anchor, 1.5);
			const s = worldToScreen(1234, -56, vp);
			expect(s.x).toBeCloseTo(400, 9);
			expect(s.y).toBeCloseTo(450, 9);
		}
	});
	it("fixed keeps the world upright; rotate turns it by -heading", () => {
		expect(targetRotation("fixed", 70)).toBe(0);
		expect(targetRotation("rotate", 70)).toBe(-70);
		expect(targetRotation("rotate", -180)).toBe(180);
	});
	it("in rotate mode the character's heading points screen-up", () => {
		const heading = 70;
		const vp = followViewport(
			{ focus: { x: 0, y: 0 }, rotation: targetRotation("rotate", heading) },
			{ x: 0, y: 0 },
			1,
		);
		const rad = (heading * Math.PI) / 180;
		const ahead = worldToScreen(Math.sin(rad), -Math.cos(rad), vp);
		expect(ahead.x).toBeCloseTo(0, 9);
		expect(ahead.y).toBeCloseTo(-1, 9);
	});
});

describe("smoothing", () => {
	it("0 is rigid; heavier smoothing lags more; dt 0 doesn't move", () => {
		expect(smoothingAlpha(0, 1 / 60)).toBe(1);
		expect(smoothingAlpha(0.9, 1 / 60)).toBeCloseTo(0.1, 9);
		expect(smoothingAlpha(0.5, 0)).toBe(0);
	});
	it("is frame-rate independent (two half steps ≈ one full step)", () => {
		const full = smoothingAlpha(0.8, 1 / 30);
		const half = smoothingAlpha(0.8, 1 / 60);
		expect(1 - (1 - half) ** 2).toBeCloseTo(full, 9);
	});
	it("eases the rotation the short way round", () => {
		const next = easeFocus(
			{ focus: { x: 0, y: 0 }, rotation: 170 },
			{ focus: { x: 10, y: 0 }, rotation: -170 },
			0.5,
		);
		expect(next.focus.x).toBe(5);
		expect(next.rotation).toBe(180);
	});
	it("sameViewport ignores sub-pixel noise and treats a missing rotation as 0", () => {
		expect(sameViewport({ x: 1, y: 1, zoom: 1 }, { x: 1.001, y: 1, zoom: 1, rotation: 0 })).toBe(
			true,
		);
		expect(sameViewport({ x: 1, y: 1, zoom: 1 }, { x: 1, y: 1, zoom: 1, rotation: 1 })).toBe(false);
	});
});
