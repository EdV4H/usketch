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
	/** Vehicle: the drift key (only acts when drift is enabled). */
	drift?: boolean;
}

export const NO_INPUT: MoveInput = {
	up: false,
	down: false,
	left: false,
	right: false,
	drift: false,
};

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
	/** Vehicle: the held steering, -1 (left) … 1 (right). 0 for `directional`. */
	steering: number;
	/**
	 * Vehicle: body yaw relative to `heading`, degrees (clockwise-positive). The car
	 * travels along `heading` but is drawn at `heading + slip` while drifting.
	 */
	slip: number;
	/** Vehicle: the running drift's direction, -1 (left) / 1 (right), 0 = not drifting. */
	drift: -1 | 0 | 1;
}

/** A pose at rest at the origin, facing up. */
export const ORIGIN_POSE: CharacterPose = {
	x: 0,
	y: 0,
	heading: 0,
	speed: 0,
	moving: false,
	steering: 0,
	slip: 0,
	drift: 0,
};

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

/**
 * Vehicle drift tuning: holding the drift key while steering at speed starts an
 * arcade drift (a tighter turn with the body slid into it); releasing the key,
 * slowing down or reversing ends it, and the slip eases back.
 */
export interface DriftParams {
	/** Speed that starts a drift, as a fraction of `moveSpeed`. */
	startSpeed: number;
	/** Speed below which a drift ends, as a fraction of `moveSpeed`. */
	stopSpeed: number;
	/** Turn rate while drifting, as a multiple of `turnRate`. */
	turnRate: number;
	/**
	 * How much steering tightens (into the drift) or opens (against it) the turn,
	 * as a multiple of `turnRate`. Countersteering never spins the car.
	 */
	steerRate: number;
	/** Body slip while drifting, degrees. */
	slipAngle: number;
	/** Extra slip when steering into the drift, degrees. */
	steerSlipAngle: number;
	/** How fast the slip follows its target (1/s, exponential). */
	recoveryRate: number;
}

export const DEFAULT_DRIFT: DriftParams = {
	startSpeed: 0.27,
	stopSpeed: 0.17,
	turnRate: 1.27,
	steerRate: 0.23,
	slipAngle: 28,
	steerSlipAngle: 8,
	recoveryRate: 8,
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
 *   when reversing, like a car. With `driftParams`, holding the drift key while
 *   steering at speed drifts (see `DriftParams`).
 */
export function stepCharacter(
	pose: CharacterPose,
	input: MoveInput,
	dt: number,
	scheme: ControlScheme,
	params: MotionParams,
	cameraRotation = 0,
	driftParams: DriftParams | null = null,
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
			steering: 0,
			slip: 0,
			drift: 0,
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

	const steering = (input.right ? 1 : 0) - (input.left ? 1 : 0);
	const drift = nextDrift(pose.drift, input.drift === true, steering, speed, params, driftParams);
	let turn: number;
	if (drift !== 0 && driftParams) {
		const into = steering * drift;
		turn = drift * (driftParams.turnRate + into * driftParams.steerRate) * params.turnRate;
	} else {
		const authority = Math.min(1, (Math.abs(speed) / Math.max(1, params.moveSpeed)) * 3);
		turn = steering * Math.sign(speed) * authority * params.turnRate;
	}
	const heading = turn === 0 ? pose.heading : wrapDeg(pose.heading + turn * dt);
	const slip = nextSlip(pose.slip, drift, steering, dt, driftParams ?? DEFAULT_DRIFT);

	if (
		speed === 0 &&
		heading === pose.heading &&
		steering === pose.steering &&
		slip === pose.slip &&
		drift === pose.drift
	) {
		return pose.moving || pose.speed !== 0 ? { ...pose, speed: 0, moving: false } : pose;
	}
	const dir = headingVector(heading);
	return {
		x: pose.x + dir.x * speed * dt,
		y: pose.y + dir.y * speed * dt,
		heading,
		speed,
		moving: speed !== 0,
		steering,
		slip,
		drift,
	};
}

function nextDrift(
	current: -1 | 0 | 1,
	held: boolean,
	steering: number,
	speed: number,
	params: MotionParams,
	driftParams: DriftParams | null,
): -1 | 0 | 1 {
	if (!driftParams || !held) return 0;
	if (current !== 0) return speed < driftParams.stopSpeed * params.moveSpeed ? 0 : current;
	if (steering === 0 || speed < driftParams.startSpeed * params.moveSpeed) return 0;
	return steering > 0 ? 1 : -1;
}

function nextSlip(
	slip: number,
	drift: -1 | 0 | 1,
	steering: number,
	dt: number,
	driftParams: DriftParams,
): number {
	const target =
		drift * (driftParams.slipAngle + Math.max(0, steering * drift) * driftParams.steerSlipAngle);
	const next = slip + (target - slip) * (1 - Math.exp(-driftParams.recoveryRate * dt));
	return Math.abs(next - target) < 0.001 ? target : next;
}
