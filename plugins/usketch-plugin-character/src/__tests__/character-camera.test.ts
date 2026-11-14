import { worldToScreen } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import {
	anchorPx,
	defaultCameraHeightMargin,
	easeFocus,
	followCameraHeight,
	followViewport,
	sameViewport,
	smoothingAlpha,
	targetRotation,
	turnedByView,
} from "../character-camera.js";

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

describe("followCameraHeight", () => {
	const air = (z: number) => ({ z, airborne: true });
	const ground = (z: number) => ({ z, airborne: false });
	it("follows the body on the ground", () => {
		expect(followCameraHeight(null, ground(100), 48)).toBe(100);
		expect(followCameraHeight(100, ground(130), 48)).toBe(130); // up a slope
	});
	it("holds the take-off height through an ordinary jump", () => {
		expect(followCameraHeight(100, air(140), 48)).toBe(100);
	});
	it("doesn't dip over a pit", () => {
		// Ran off a ledge at 100: the body is still at 100, the ground below is lower.
		expect(followCameraHeight(100, air(100), 48)).toBe(100);
	});
	it("rises with a hover past the margin", () => {
		expect(followCameraHeight(10, air(40), 40)).toBe(10);
		expect(followCameraHeight(10, air(80), 40)).toBe(40);
	});
	it("follows a fall below the take-off height", () => {
		expect(followCameraHeight(50, air(20), 40)).toBe(20);
	});
	it("starts from the body when it begins mid-air", () => {
		expect(followCameraHeight(null, air(70), 40)).toBe(70);
	});
	it("margin 0 (or negative) follows the body", () => {
		expect(followCameraHeight(10, air(30), 0)).toBe(30);
		expect(followCameraHeight(10, air(30), -5)).toBe(30);
	});
	it("treats a non-finite height as 0", () => {
		expect(followCameraHeight(10, ground(Number.NaN), 40)).toBe(0);
	});
	it("defaults the margin to the jump (or drift hop) height", () => {
		expect(defaultCameraHeightMargin(48, 0)).toBe(48);
		expect(defaultCameraHeightMargin(null, 12)).toBe(12);
		expect(defaultCameraHeightMargin(null, 0)).toBe(0);
	});
});

describe("turnedByView", () => {
	it("is the 3D view's turn only when the view turned by the same amount", () => {
		expect(turnedByView(15, 15)).toBe(true);
		expect(turnedByView(-170, 190)).toBe(true); // the same turn, wrapped
		expect(turnedByView(15, 0)).toBe(false); // someone else turned it
		expect(turnedByView(0, 0)).toBe(false); // not turned at all (a pan)
	});
});
