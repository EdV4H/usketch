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
	/** The jump key is held (a release while rising cuts the jump short). */
	jump?: boolean;
	/** The jump key was pressed since the previous step (an edge, so a quick tap counts). */
	jumpPressed?: boolean;
}

export const NO_INPUT: MoveInput = {
	up: false,
	down: false,
	left: false,
	right: false,
	drift: false,
	jump: false,
	jumpPressed: false,
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
	/**
	 * Height of the character's feet, world units — absolute, like the ground height
	 * (0 = the flat board). On the ground it equals the ground height; it rises above it
	 * while jumping or falling, so it stays smooth across cliff edges.
	 */
	z: number;
	/** Vertical speed, world units / s (positive = rising). */
	vz: number;
	/** Whether the character is in the air (jumping or falling). */
	airborne: boolean;
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
	z: 0,
	vz: 0,
	airborne: false,
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
	/** Tallest step up the character can climb, world units (ground height, e.g. the map
	 *  plugin's raised terrain). Stepping DOWN is always allowed. */
	maxStep: number;
}

export const DEFAULT_MOTION: MotionParams = {
	moveSpeed: 400,
	turnRate: 240,
	acceleration: 900,
	friction: 700,
	reverseRatio: 0.5,
	maxStep: 24,
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
	 * as a multiple of `turnRate`. Capped at the drift `turnRate`, so
	 * countersteering never turns the car the other way.
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
			z: pose.z,
			vz: pose.vz,
			airborne: pose.airborne,
		};
	}

	// In the air a car keeps its momentum: no throttle, brakes or steering until it lands.
	const grounded = !pose.airborne;
	const throttle = (input.up ? 1 : 0) - (input.down ? 1 : 0);
	const speed = grounded ? throttledSpeed(pose.speed, throttle, dt, params) : pose.speed;
	const steering = grounded ? (input.right ? 1 : 0) - (input.left ? 1 : 0) : 0;
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
		z: pose.z,
		vz: pose.vz,
		airborne: pose.airborne,
	};
}

/** Ground height at a world point (world units; see `groundHeightService`). */
export type HeightAt = (x: number, y: number) => number;

/**
 * Keep a step from `prev` to `next` on climbable ground: moving onto ground more than
 * `maxStep` higher than where the character stands is blocked. A blocked move first
 * tries to slide along the cliff (keep only the x or only the y part), so walking into
 * a wall at an angle glides along it; failing both, the character stays put (a
 * vehicle also loses its speed, as if it bumped the wall). The heading still turns.
 */
export function constrainToGround(
	prev: CharacterPose,
	next: CharacterPose,
	heightAt: HeightAt,
	maxStep: number,
): CharacterPose {
	if (next.x === prev.x && next.y === prev.y) return next;
	// Measured from the feet: on the ground that is the ground itself, in the air it is
	// higher, so a jump clears cliffs the step alone can't.
	const feet = Math.max(heightAt(prev.x, prev.y), prev.z ?? 0);
	const limit = feet + Math.max(0, maxStep);
	const ok = (x: number, y: number) => heightAt(x, y) <= limit;
	if (ok(next.x, next.y)) return next;
	if (next.x !== prev.x && ok(next.x, prev.y)) return { ...next, y: prev.y };
	if (next.y !== prev.y && ok(prev.x, next.y)) return { ...next, x: prev.x };
	return { ...next, x: prev.x, y: prev.y, speed: 0, moving: false };
}

/**
 * Jump tuning. The arc is set by its apex `height` and `timeToApex`; gravity and the
 * take-off speed follow from them (see `jumpArc`).
 */
export interface JumpParams {
	/** Apex of a jump from the ground, world units above the take-off point. */
	height: number;
	/** Seconds from take-off to the apex. */
	timeToApex: number;
	/** Gravity multiplier while falling (> 1 = floaty rise, snappy fall). */
	fallGravity: number;
	/** Releasing the key while rising scales the vertical speed by this (0 … 1): a short hop. */
	releaseCut: number;
	/** Seconds after walking off a ledge during which a jump still counts as from the ground. */
	coyoteTime: number;
	/** Seconds a press just before landing is remembered and jumps on touchdown. */
	bufferTime: number;
}

export const DEFAULT_JUMP: JumpParams = {
	height: 40,
	timeToApex: 0.32,
	fallGravity: 1.5,
	releaseCut: 0.5,
	coyoteTime: 0.1,
	bufferTime: 0.1,
};

/** Gravity (world units / s²) and take-off speed (world units / s) of a jump. */
export function jumpArc(params: JumpParams): { gravity: number; speed: number } {
	const t = Math.max(0.01, params.timeToApex);
	return { gravity: (2 * params.height) / (t * t), speed: (2 * params.height) / t };
}

/** Per-character jump bookkeeping that is not part of the visible pose. */
export interface JumpTimers {
	/** Seconds since the character last stood on the ground. */
	sinceGround: number;
	/** Seconds since the jump key was last pressed (`Infinity` = no pending press). */
	sincePress: number;
	/** The current airtime started with a jump (not a fall), so coyote time is spent. */
	jumped: boolean;
	/** The rise has been cut short already (the key was released). */
	cut: boolean;
}

export const IDLE_JUMP: JumpTimers = {
	sinceGround: 0,
	sincePress: Number.POSITIVE_INFINITY,
	jumped: false,
	cut: false,
};

/**
 * Advance the vertical motion by `dt` seconds, after the horizontal step put the
 * character over ground of height `ground`.
 *
 * - On the ground, a step up (already limited to `maxStep` by `constrainToGround`) or a
 *   step down of at most `maxStep` keeps the feet on the ground; a bigger drop starts a
 *   fall instead of snapping down.
 * - With `jump` tuning, a press (or one buffered for `bufferTime`) jumps from the ground
 *   or within `coyoteTime` of leaving it; releasing the key while rising cuts the jump.
 * - In the air, gravity pulls the feet down (`fallGravity` × while falling) until they
 *   meet the ground. Without `jump` the default arc's gravity still drives falls.
 */
export function stepVertical(
	pose: CharacterPose,
	timers: JumpTimers,
	input: MoveInput,
	dt: number,
	ground: number,
	maxStep: number,
	jump: JumpParams | null,
): { pose: CharacterPose; timers: JumpTimers } {
	if (dt <= 0) return { pose, timers };
	let { z, vz, airborne } = pose;
	let { sinceGround, sincePress, jumped, cut } = timers;

	if (!airborne) {
		if (z - ground > Math.max(0, maxStep)) {
			airborne = true; // walked off a cliff: fall
			vz = 0;
		} else {
			z = ground;
			jumped = false; // e.g. teleported mid-jump
			cut = false;
		}
	} else if (z < ground) {
		z = ground; // reached a ledge within the step mid-air: stand on its edge
	}
	sinceGround = airborne ? sinceGround + dt : 0;

	const arc = jumpArc(jump ?? DEFAULT_JUMP);
	if (jump) {
		sincePress = input.jumpPressed ? 0 : sincePress + dt;
		const fromGround = !airborne || (!jumped && sinceGround <= jump.coyoteTime);
		if (sincePress <= jump.bufferTime && fromGround) {
			airborne = true;
			vz = arc.speed;
			jumped = true;
			cut = false;
			sincePress = Number.POSITIVE_INFINITY;
		} else if (jumped && !cut && vz > 0 && !input.jump) {
			vz *= Math.min(1, Math.max(0, jump.releaseCut));
			cut = true;
		}
	} else {
		sincePress = Number.POSITIVE_INFINITY;
	}

	if (airborne) {
		const gravity = vz > 0 ? arc.gravity : arc.gravity * (jump ?? DEFAULT_JUMP).fallGravity;
		vz -= gravity * dt;
		z += vz * dt;
		if (z <= ground) {
			z = ground;
			vz = 0;
			airborne = false;
			jumped = false;
			cut = false;
			sinceGround = 0;
		}
	}

	const nextTimers =
		sinceGround === timers.sinceGround &&
		sincePress === timers.sincePress &&
		jumped === timers.jumped &&
		cut === timers.cut
			? timers
			: { sinceGround, sincePress, jumped, cut };
	const nextPose =
		z === pose.z && vz === pose.vz && airborne === pose.airborne
			? pose
			: { ...pose, z, vz, airborne };
	return { pose: nextPose, timers: nextTimers };
}

/** Vehicle speed after a step of throttle (1), reverse (-1) or coasting (0). */
function throttledSpeed(speed: number, throttle: number, dt: number, params: MotionParams): number {
	if (throttle > 0) {
		// Braking from reverse uses friction + throttle for a snappier stop.
		const accel = speed < 0 ? params.acceleration + params.friction : params.acceleration;
		return approach(speed, params.moveSpeed, accel * dt);
	}
	if (throttle < 0) {
		const accel = speed > 0 ? params.acceleration + params.friction : params.acceleration;
		return approach(speed, -params.moveSpeed * params.reverseRatio, accel * dt);
	}
	return approach(speed, 0, params.friction * dt);
}

function nextDrift(
	current: -1 | 0 | 1,
	held: boolean,
	steering: number,
	speed: number,
	params: MotionParams,
	driftParams: DriftParams | null,
): -1 | 0 | 1 {
	// Drifts only run forward: a stopped car never spins in place, whatever the tuning.
	if (!driftParams || !held || speed <= 0) return 0;
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
