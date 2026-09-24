// Pure motion model (no React / DOM): input + dt → next pose. Headings are degrees,
// 0 = up (world -y), clockwise-positive — the same convention as CSS `rotate()` and
// the Core viewport `rotation`, so `screenHeading = heading + viewport.rotation`.
import { shortestAngleDelta, wrapDeg } from "@edv4h/usketch-shared";

export type ControlScheme = "directional" | "vehicle";

/** Which movement directions are currently held. */
export interface MoveInput {
	up: boolean;
	down: boolean;
	left: boolean;
	right: boolean;
}

export const NO_INPUT: MoveInput = { up: false, down: false, left: false, right: false };

export interface CharacterPose {
	/** World position. */
	x: number;
	y: number;
	/** Facing, degrees (0 = up / -y, clockwise). */
	heading: number;
	/** Signed speed along the heading, world units / s (negative = reversing). */
	speed: number;
	/** Whether the character moved this step. */
	moving: boolean;
}

export interface MotionParams {
	/** Top speed, world units / s. */
	moveSpeed: number;
	/** Turn rate, degrees / s. */
	turnRate: number;
	/** Vehicle: throttle acceleration, world units / s². */
	acceleration: number;
	/** Vehicle: coasting / braking deceleration, world units / s². */
	friction: number;
	/** Vehicle: reverse top speed as a fraction of `moveSpeed`. */
	reverseRatio: number;
}

export const DEFAULT_MOTION: MotionParams = {
	moveSpeed: 400,
	turnRate: 240,
	acceleration: 900,
	friction: 700,
	reverseRatio: 0.5,
};

/** Unit vector of a heading in world space (0° → (0, -1), 90° → (1, 0)). */
export function headingVector(deg: number): { x: number; y: number } {
	const rad = (deg * Math.PI) / 180;
	return { x: Math.sin(rad), y: -Math.cos(rad) };
}

/** Heading (degrees) of a non-zero world vector. */
export function vectorHeading(x: number, y: number): number {
	return wrapDeg((Math.atan2(x, -y) * 180) / Math.PI);
}

/** Move `from` toward `to` by at most `maxStep` degrees, the short way round. */
export function turnToward(from: number, to: number, maxStep: number): number {
	const d = shortestAngleDelta(from, to);
	if (Math.abs(d) <= maxStep) return wrapDeg(to);
	return wrapDeg(from + Math.sign(d) * maxStep);
}

function approach(v: number, target: number, step: number): number {
	if (v < target) return Math.min(target, v + step);
	return Math.max(target, v - step);
}

/**
 * Advance `pose` by `dt` seconds.
 *
 * - `directional`: the held keys give a SCREEN-space direction (up = screen up),
 *   turned into world space through the camera rotation; the character moves that
 *   way at `moveSpeed` and its heading turns toward it at `turnRate`. (Turning
 *   rather than snapping keeps a heading-following camera from spinning.)
 * - `vehicle`: up/down are throttle/reverse along the heading, left/right steer.
 *   Steering authority scales with speed (a stopped car can't turn) and inverts
 *   when reversing, like a car.
 */
export function stepCharacter(
	pose: CharacterPose,
	input: MoveInput,
	dt: number,
	scheme: ControlScheme,
	params: MotionParams,
	cameraRotation = 0,
): CharacterPose {
	if (dt <= 0) return pose;
	if (scheme === "directional") {
		const sx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
		const sy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
		if (sx === 0 && sy === 0) {
			return pose.moving || pose.speed !== 0 ? { ...pose, speed: 0, moving: false } : pose;
		}
		// Screen direction → world direction: undo the camera rotation.
		const target = wrapDeg(vectorHeading(sx, sy) - cameraRotation);
		const dir = headingVector(target);
		const dist = params.moveSpeed * dt;
		return {
			x: pose.x + dir.x * dist,
			y: pose.y + dir.y * dist,
			heading: turnToward(pose.heading, target, params.turnRate * dt),
			speed: params.moveSpeed,
			moving: true,
		};
	}

	const throttle = (input.up ? 1 : 0) - (input.down ? 1 : 0);
	let speed = pose.speed;
	if (throttle > 0) {
		// Braking from reverse uses friction + throttle for a snappier stop.
		const accel = speed < 0 ? params.acceleration + params.friction : params.acceleration;
		speed = approach(speed, params.moveSpeed, accel * dt);
	} else if (throttle < 0) {
		const accel = speed > 0 ? params.acceleration + params.friction : params.acceleration;
		speed = approach(speed, -params.moveSpeed * params.reverseRatio, accel * dt);
	} else {
		speed = approach(speed, 0, params.friction * dt);
	}

	const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
	const authority = Math.min(1, (Math.abs(speed) / Math.max(1, params.moveSpeed)) * 3);
	const heading =
		steer === 0 || authority === 0
			? pose.heading
			: wrapDeg(pose.heading + steer * Math.sign(speed) * authority * params.turnRate * dt);

	if (speed === 0 && heading === pose.heading) {
		return pose.moving || pose.speed !== 0 ? { ...pose, speed: 0, moving: false } : pose;
	}
	const dir = headingVector(heading);
	return {
		x: pose.x + dir.x * speed * dt,
		y: pose.y + dir.y * speed * dt,
		heading,
		speed,
		moving: speed !== 0,
	};
}
