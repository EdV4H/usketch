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
	/** The drift key was pressed since the previous step (an edge: starts a drift hop). */
	driftPressed?: boolean;
	/** The jump key is held (a release while rising cuts the jump short). */
	jump?: boolean;
	/** The jump key was pressed since the previous step (an edge, so a quick tap counts). */
	jumpPressed?: boolean;
	/**
	 * Analog forward / back, -1 (full reverse / screen down) … 1 (full throttle / screen
	 * up), e.g. from a touch stick. When set it replaces `up` / `down`.
	 */
	throttle?: number;
	/** Analog steering, -1 (left) … 1 (right). When set it replaces `left` / `right`. */
	steer?: number;
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
	/**
	 * Sideways speed in the air, world units / s: a jump off a slope leaves the ground
	 * partly along it (see `JumpParams.slopeRatio`). Added to the move while airborne,
	 * cleared on landing.
	 */
	vx: number;
	vy: number;
	/**
	 * Velocity of the move itself (the walk or the drive), world units / s: what a jump
	 * carries into the air. On the ground the keys set it at once; in the air they only
	 * pull it around as far as `JumpParams.airControl` allows.
	 */
	moveVx: number;
	moveVy: number;
	/**
	 * Vehicle: the body's attitude in the air, degrees, relative to lying flat on the
	 * ground — `pitch` nose up (+) / down (−), `roll` right side down (+) / left side
	 * down (−), each kept in −180 … 180. Turned with the keys while airborne (see
	 * `stepAirSpin`), back to 0 on landing (see `landVehicle`). Always 0 on the ground.
	 */
	pitch: number;
	roll: number;
	/**
	 * Vehicle: how fast the body is turning about those axes, degrees / s — its spin,
	 * which carries on after the keys are released while `JumpParams.spinInertia` > 0.
	 * 0 on the ground.
	 */
	pitchRate: number;
	rollRate: number;
	/** Whether the character is in the air (jumping or falling). */
	airborne: boolean;
	/** Hovering: the jump key held while falling slows the descent (see `HoverParams`). */
	hovering: boolean;
	/**
	 * Hover gauge, 0 (empty) … 1 (full): drains while hovering, refills on the ground.
	 * Stays 1 while hovering is off.
	 */
	hoverGauge: number;
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
	vx: 0,
	vy: 0,
	moveVx: 0,
	moveVy: 0,
	pitch: 0,
	roll: 0,
	pitchRate: 0,
	rollRate: 0,
	airborne: false,
	hovering: false,
	hoverGauge: 1,
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
	/**
	 * Steepest slope the character can walk up, degrees; `0` = no limit. Steeper ground
	 * (an elevation hill) blocks the way up like a cliff, and standing on it slides down.
	 * Steps (the map's terrain levels) are left to `maxStep`: see {@link groundSlope}.
	 * A jump still clears it.
	 */
	maxSlope: number;
	/**
	 * How far the character leans with the ground under it in a 3D view (Mode 7), `0`
	 * (stays level) … `1` (lies along the slope). Only the look.
	 */
	slopeTilt: number;
}

export const DEFAULT_MOTION: MotionParams = {
	moveSpeed: 400,
	turnRate: 240,
	acceleration: 900,
	friction: 700,
	reverseRatio: 0.5,
	maxStep: 24,
	maxSlope: 0,
	slopeTilt: 1,
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
	/**
	 * Pressing the drift key on the ground hops first (a small jump; the drift starts on
	 * landing if still held and steering, since a car can't steer in the air).
	 */
	hop: boolean;
	/** Height of that hop, world units. */
	hopHeight: number;
}

export const DEFAULT_DRIFT: DriftParams = {
	startSpeed: 0.27,
	stopSpeed: 0.17,
	turnRate: 1.27,
	steerRate: 0.23,
	slipAngle: 28,
	steerSlipAngle: 8,
	recoveryRate: 8,
	hop: false,
	hopHeight: 10,
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

/** Clamp to -1 … 1; a missing or non-finite value counts as 0 (released). */
export const clampUnit = (v: number | undefined): number =>
	v !== undefined && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;

/** Forward / back of an input, -1 … 1: the analog `throttle` when set, else up − down. */
export function inputThrottle(input: MoveInput): number {
	if (input.throttle !== undefined) return clampUnit(input.throttle);
	return (input.up ? 1 : 0) - (input.down ? 1 : 0);
}

/** Left / right of an input, -1 … 1: the analog `steer` when set, else right − left. */
export function inputSteer(input: MoveInput): number {
	if (input.steer !== undefined) return clampUnit(input.steer);
	return (input.right ? 1 : 0) - (input.left ? 1 : 0);
}

function approach(v: number, target: number, step: number): number {
	if (v < target) return Math.min(target, v + step);
	return Math.max(target, v - step);
}

/**
 * Seconds a full {@link JumpParams.airControl} (just under 1) takes to bring the move in
 * the air from a stop to full speed (or a full-speed move to a stop). Lower control
 * stretches it (`AIR_CONTROL_TIME / airControl`); at 1 the keys act at once, as on the
 * ground.
 */
export const AIR_CONTROL_TIME = 0.1;

/** Clamp an air control setting to 0 … 1 (a non-finite one counts as 1: full control). */
export const clampAirControl = (v: number): number =>
	Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;

/**
 * Advance `pose` by `dt` seconds.
 *
 * - `directional`: the held keys give a SCREEN-space direction (up = screen up),
 *   turned into world space through the camera rotation; the character moves that
 *   way at `moveSpeed` and its heading turns toward it at `turnRate`. (Turning
 *   rather than snapping keeps a heading-following camera from spinning.) An analog
 *   input (`steer` / `throttle`) moves at `moveSpeed` × its length (capped at 1).
 * - `vehicle`: up/down are throttle/reverse along the heading, left/right steer.
 *   Steering authority scales with speed (a stopped car can't turn) and inverts
 *   when reversing, like a car. With `driftParams`, holding the drift key while
 *   steering at speed drifts (see `DriftParams`). An analog `throttle` aims for that
 *   fraction of the top speed, and an analog `steer` turns by that fraction.
 * - In the air, `airControl` (0 … 1) is how much of that handling is left: a walk keeps
 *   its take-off velocity and the keys pull it toward theirs (see `AIR_CONTROL_TIME`;
 *   at 1 they set it at once, as on the ground), and a car keeps its speed (no throttle
 *   or brakes) while steering at `airControl` × the ground's — the way it travels
 *   turns with it.
 */
export function stepCharacter(
	pose: CharacterPose,
	input: MoveInput,
	dt: number,
	scheme: ControlScheme,
	params: MotionParams,
	cameraRotation = 0,
	driftParams: DriftParams | null = null,
	airControl = DEFAULT_JUMP.airControl,
): CharacterPose {
	if (dt <= 0) return pose;
	const control = clampAirControl(airControl);
	if (scheme === "directional") {
		const sx = inputSteer(input);
		const sy = -inputThrottle(input);
		const held = sx !== 0 || sy !== 0;
		// Screen direction → world direction: undo the camera rotation.
		const target = held ? wrapDeg(vectorHeading(sx, sy) - cameraRotation) : pose.heading;
		const dir = headingVector(target);
		// Keys are always full speed (diagonals normalized); an analog stick scales it.
		const want = held ? params.moveSpeed * Math.min(1, Math.hypot(sx, sy)) : 0;
		let vx = dir.x * want;
		let vy = dir.y * want;
		if (pose.airborne && control < 1) {
			// In the air the move keeps its momentum; the keys only pull it around.
			const reach = (params.moveSpeed * control * dt) / AIR_CONTROL_TIME;
			({ x: vx, y: vy } = approachVector(pose.moveVx, pose.moveVy, vx, vy, reach));
		}
		const speed = Math.hypot(vx, vy);
		if (speed === 0) {
			return pose.moving || pose.speed !== 0 || pose.moveVx !== 0 || pose.moveVy !== 0
				? { ...pose, speed: 0, moving: false, moveVx: 0, moveVy: 0 }
				: pose;
		}
		return {
			x: pose.x + vx * dt,
			y: pose.y + vy * dt,
			// Faces the keys while they are held, else keeps its facing (drifting on in the air).
			heading: held ? turnToward(pose.heading, target, params.turnRate * dt) : pose.heading,
			speed,
			moving: true,
			steering: 0,
			slip: 0,
			drift: 0,
			z: pose.z,
			vz: pose.vz,
			vx: pose.vx,
			vy: pose.vy,
			moveVx: vx,
			moveVy: vy,
			pitch: pose.pitch,
			roll: pose.roll,
			pitchRate: pose.pitchRate,
			rollRate: pose.rollRate,
			airborne: pose.airborne,
			hovering: pose.hovering,
			hoverGauge: pose.hoverGauge,
		};
	}

	// In the air a car keeps its momentum: no throttle or brakes until it lands, and the
	// steering only as far as the air control allows.
	const grounded = !pose.airborne;
	const speed = grounded
		? throttledSpeed(pose.speed, inputThrottle(input), dt, params)
		: pose.speed;
	// (`+ 0` turns a -0 from no control into 0.)
	const steering = grounded ? inputSteer(input) : inputSteer(input) * control + 0;
	// A drift starts only on the ground (a running one carries on through the air).
	const drift =
		grounded || pose.drift !== 0
			? nextDrift(pose.drift, input.drift === true, steering, speed, params, driftParams)
			: 0;
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
		return pose.moving || pose.speed !== 0 || pose.moveVx !== 0 || pose.moveVy !== 0
			? { ...pose, speed: 0, moving: false, moveVx: 0, moveVy: 0 }
			: pose;
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
		vx: pose.vx,
		vy: pose.vy,
		moveVx: dir.x * speed,
		moveVy: dir.y * speed,
		pitch: pose.pitch,
		roll: pose.roll,
		pitchRate: pose.pitchRate,
		rollRate: pose.rollRate,
		airborne: pose.airborne,
		hovering: pose.hovering,
		hoverGauge: pose.hoverGauge,
	};
}

/** Move the vector `(x, y)` toward `(tx, ty)` by at most `step` (its length). */
function approachVector(
	x: number,
	y: number,
	tx: number,
	ty: number,
	step: number,
): { x: number; y: number } {
	const dx = tx - x;
	const dy = ty - y;
	const d = Math.hypot(dx, dy);
	if (d <= step) return { x: tx, y: ty };
	if (!(step > 0)) return { x, y };
	return { x: x + (dx / d) * step, y: y + (dy / d) * step };
}

/** Ground height at a world point (world units; see `groundHeightService`). */
export type HeightAt = (x: number, y: number) => number;

/** A solid's top at a world point (see `solidHeightService`): `null` = none, `Infinity` = wall. */
export type SolidAt = (x: number, y: number) => number | null;

/**
 * The height a move is checked against (`constrainToGround`): the ground, or a solid
 * standing on it when that is higher — a wall (`Infinity`) always blocks. Pure.
 */
export function blockingHeight(ground: number, solid: number | null): number {
	return solid !== null && solid > ground ? solid : ground;
}

/**
 * The height the feet stand on (landing, shadow, 3D lift): like {@link blockingHeight}
 * but only a top that can be stood on counts, never a wall. Pure.
 */
export function standingHeight(ground: number, solid: number | null): number {
	return solid !== null && Number.isFinite(solid) && solid > ground ? solid : ground;
}

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
	maxSlope = 0,
): CharacterPose {
	if (next.x === prev.x && next.y === prev.y) return next;
	// Measured from the feet: on the ground that is the ground itself, in the air it is
	// higher, so a jump clears cliffs the step alone can't.
	const feet = Math.max(heightAt(prev.x, prev.y), prev.z ?? 0);
	const limit = feet + Math.max(0, maxStep);
	// The slope only binds on the ground: in the air the feet clear it like a cliff.
	const steep = !prev.airborne && maxSlope > 0 ? slopeLimit(maxSlope) : Number.POSITIVE_INFINITY;
	const ok = (x: number, y: number) =>
		heightAt(x, y) <= limit && risingSlope(heightAt, prev, x, y) <= steep;
	if (ok(next.x, next.y)) return next;
	if (next.x !== prev.x && ok(next.x, prev.y)) return { ...next, y: prev.y };
	if (next.y !== prev.y && ok(prev.x, next.y)) return { ...next, x: prev.x };
	return { ...next, x: prev.x, y: prev.y, speed: 0, moving: false, moveVx: 0, moveVy: 0 };
}

/** Half-width of the stencil that measures the ground's slope, world units. */
export const SLOPE_PROBE = 8;

/**
 * The smaller of two same-signed differences, 0 when they disagree (a "minmod"). Taken
 * over the stretch before and after a point, a smooth slope keeps its gradient while a
 * step (flat on one side of it) gives 0: steps stay `maxStep`'s business.
 */
function minmod(a: number, b: number): number {
	if (!(a * b > 0)) return 0;
	return Math.abs(a) < Math.abs(b) ? a : b;
}

/** `tan(maxSlope)` for a limit in degrees (capped below vertical). */
function slopeLimit(maxSlope: number): number {
	return Math.tan((Math.min(89, maxSlope) * Math.PI) / 180);
}

/**
 * The ground's gradient at a point (rise per world unit along x and y), measured
 * {@link SLOPE_PROBE} units to either side with a minmod: a smooth slope reads as its
 * gradient, a step — or a wall — next to the point as flat. Pure.
 */
export function groundSlope(
	heightAt: HeightAt,
	x: number,
	y: number,
	probe = SLOPE_PROBE,
): { x: number; y: number } {
	const h = heightAt(x, y);
	if (!Number.isFinite(h)) return { x: 0, y: 0 };
	const gx = minmod(h - heightAt(x - probe, y), heightAt(x + probe, y) - h) / probe;
	const gy = minmod(h - heightAt(x, y - probe), heightAt(x, y + probe) - h) / probe;
	return { x: Number.isFinite(gx) ? gx : 0, y: Number.isFinite(gy) ? gy : 0 };
}

/** The ground's rise per unit at `(x, y)` along the way from `from` to it (0 = flat). */
function risingSlope(
	heightAt: HeightAt,
	from: { x: number; y: number },
	x: number,
	y: number,
): number {
	const d = Math.hypot(x - from.x, y - from.y);
	if (!(d > 0)) return 0;
	const ux = ((x - from.x) / d) * SLOPE_PROBE;
	const uy = ((y - from.y) / d) * SLOPE_PROBE;
	const h = heightAt(x, y);
	const rise = minmod(h - heightAt(x - ux, y - uy), heightAt(x + ux, y + uy) - h) / SLOPE_PROBE;
	return Number.isFinite(rise) ? rise : 0;
}

/** Sliding speed down ground steeper than `maxSlope`, as a fraction of `moveSpeed`. */
export const SLIDE_SPEED = 0.5;

/**
 * On ground steeper than `motion.maxSlope`, slide `dt` seconds downhill (at
 * {@link SLIDE_SPEED} × `moveSpeed`); walls still block (`blockAt`). Unchanged in the
 * air, on gentle ground, or with no slope limit. Pure.
 */
export function slideOnSteep(
	pose: CharacterPose,
	heightAt: HeightAt,
	blockAt: HeightAt,
	motion: Pick<MotionParams, "maxSlope" | "maxStep" | "moveSpeed">,
	dt: number,
): CharacterPose {
	if (pose.airborne || !(motion.maxSlope > 0) || !(dt > 0)) return pose;
	const g = groundSlope(heightAt, pose.x, pose.y);
	const m = Math.hypot(g.x, g.y);
	if (!(m > slopeLimit(motion.maxSlope))) return pose;
	const d = (motion.moveSpeed * SLIDE_SPEED * dt) / m;
	const next = { ...pose, x: pose.x - g.x * d, y: pose.y - g.y * d };
	const moved = sweepToGround(pose, next, blockAt, motion.maxStep);
	return moved.x === pose.x && moved.y === pose.y ? pose : moved;
}

/** In the air, add the sideways speed a slope jump left (`vx` / `vy`) to a move. Pure. */
export function pushInAir(prev: CharacterPose, next: CharacterPose, dt: number): CharacterPose {
	if (!prev.airborne || !(dt > 0) || (prev.vx === 0 && prev.vy === 0)) return next;
	return { ...next, x: next.x + prev.vx * dt, y: next.y + prev.vy * dt };
}

/**
 * A jump's take-off velocity off ground with gradient `slope`: `speed` along a direction
 * between straight up (`ratio` 0) and the ground's normal (`ratio` 1). On flat ground
 * it is straight up whatever the ratio. Pure.
 */
export function takeoffVelocity(
	speed: number,
	slope: { x: number; y: number },
	ratio: number,
): { vx: number; vy: number; vz: number } {
	const k = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
	const nl = Math.hypot(slope.x, slope.y, 1);
	const dx = (-slope.x / nl) * k;
	const dy = (-slope.y / nl) * k;
	const dz = 1 - k + k / nl;
	const len = Math.hypot(dx, dy, dz);
	// (`+ 0` turns a -0 from a flat ground into 0.)
	return { vx: (speed * dx) / len + 0, vy: (speed * dy) / len + 0, vz: (speed * dz) / len };
}

/** Longest stretch `sweepToGround` checks in one go, world units: thin walls (a stood-up
 *  shape's base) stay solid even when a frame moves farther than they are thick. */
export const SWEEP_STEP = 4;

/**
 * {@link constrainToGround} over the whole move in stretches of at most `step` world
 * units, so a fast move can't jump over something thinner than itself. Stops at the
 * first stretch that is fully blocked. At most 256 stretches: a move longer than
 * 256 × `step` (far beyond a frame's, whose `dt` the runtime caps) takes longer ones. Pure.
 */
export function sweepToGround(
	prev: CharacterPose,
	next: CharacterPose,
	heightAt: HeightAt,
	maxStep: number,
	step = SWEEP_STEP,
	maxSlope = 0,
): CharacterPose {
	const dx = next.x - prev.x;
	const dy = next.y - prev.y;
	const n = Math.min(256, Math.ceil(Math.hypot(dx, dy) / Math.max(0.5, step)));
	if (n <= 1) return constrainToGround(prev, next, heightAt, maxStep, maxSlope);
	let cur = prev;
	for (let i = 0; i < n; i++) {
		const target = { ...next, x: cur.x + dx / n, y: cur.y + dy / n };
		const moved = constrainToGround(cur, target, heightAt, maxStep, maxSlope);
		if (moved.x === cur.x && moved.y === cur.y) return moved;
		cur = moved;
	}
	return cur;
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
	/** Extra jumps in the air (0 = a single jump, 1 = a double jump …), reset on landing. */
	airJumps: number;
	/** An air jump's height as a fraction of `height` (its take-off speed is × √ratio). */
	airJumpRatio: number;
	/** Hovering while the key is held in a fall, or `null` = off. */
	hover: HoverParams | null;
	/**
	 * Which way a jump off a slope leaves the ground: `0` = straight up, `1` = along the
	 * ground's normal (a steep slope throws it far sideways), in between = a blend. Air
	 * jumps and the drift hop always go straight up.
	 */
	slopeRatio: number;
	/**
	 * How much of the ground's handling is left in the air, `0` (none: the take-off
	 * velocity carries the jump, a car can't steer) … `1` (as on the ground). See
	 * `stepCharacter`. Falls with jumping off use the default.
	 */
	airControl: number;
	/**
	 * Vehicle: how fast the keys turn the body in the air, degrees / s (`0` = off): the
	 * throttle / brake keys pitch it (forward = nose down), and the steering rolls it
	 * while the drift key is held (else it yaws, as `airControl` allows). See
	 * `stepAirSpin`.
	 */
	spinRate: number;
	/**
	 * Vehicle: the weight of that spin, seconds: how long the keys take to bring the body
	 * from still to `spinRate` — and a released spin to a stop, so it keeps turning for a
	 * while. `0` = none (it turns only while a key is held). See `stepAirSpin`.
	 */
	spinInertia: number;
	/**
	 * Vehicle: the most a body may be tilted from the ground under it on touchdown,
	 * degrees, for a clean landing. See `landVehicle`.
	 */
	landingTolerance: number;
	/** Vehicle: the fraction of its speed a car keeps after landing beyond the tolerance (0 … 1). */
	crashSpeed: number;
}

/**
 * Hover tuning. Once the air jumps are used up (or there are none), holding the jump key
 * while falling fires a thrust and drains a gauge; an empty gauge falls normally. The
 * gauge refills on the ground over `rechargeTime` (not instantly on landing).
 *
 * The thrust is a multiple of gravity (a thrust-to-weight ratio, so no mass is needed):
 * below 1 the character still sinks, at 1 it keeps its vertical speed, above 1 it climbs
 * for as long as the key is held. Sinking is capped at `fallSpeed`, climbing at
 * `riseSpeed`.
 */
export interface HoverParams {
	/** Seconds of hover a full gauge lasts. */
	duration: number;
	/** Fastest descent while hovering, world units / s (0 = never sink). */
	fallSpeed: number;
	/** Seconds on the ground to refill an empty gauge. */
	rechargeTime: number;
	/** Thrust as a multiple of gravity: < 1 sinks, 1 balances, > 1 climbs. */
	thrust: number;
	/** Fastest climb while hovering, world units / s. */
	riseSpeed: number;
}

export const DEFAULT_HOVER: HoverParams = {
	duration: 1.5,
	fallSpeed: 15,
	rechargeTime: 0.8,
	thrust: 0,
	riseSpeed: 60,
};

export const DEFAULT_JUMP: JumpParams = {
	height: 40,
	timeToApex: 0.32,
	fallGravity: 1.5,
	releaseCut: 0.5,
	coyoteTime: 0.1,
	bufferTime: 0.1,
	airJumps: 0,
	airJumpRatio: 0.8,
	hover: null,
	slopeRatio: 0.5,
	airControl: 0.5,
	spinRate: 270,
	spinInertia: 0.3,
	landingTolerance: 35,
	crashSpeed: 0.3,
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
	/** Air jumps used since the character last stood on the ground. */
	airJumpsUsed: number;
}

export const IDLE_JUMP: JumpTimers = {
	sinceGround: 0,
	sincePress: Number.POSITIVE_INFINITY,
	jumped: false,
	cut: false,
	airJumpsUsed: 0,
};

const FLAT = { x: 0, y: 0 } as const;

/**
 * Advance the vertical motion by `dt` seconds, after the horizontal step put the
 * character over ground of height `ground`.
 *
 * - On the ground, a step up (already limited to `maxStep` by `constrainToGround`) or a
 *   step down of at most `maxStep` keeps the feet on the ground; a bigger drop starts a
 *   fall instead of snapping down.
 * - With `jump` tuning, a press (or one buffered for `bufferTime`) jumps from the ground
 *   or within `coyoteTime` of leaving it; releasing the key while rising cuts the jump.
 * - A fresh press in the air uses one of the `airJumps` while any remain (`airJumpRatio`
 *   of the height); they come back on landing.
 * - With `hover` tuning, once the air jumps are used up, holding the key while falling
 *   hovers: the thrust pushes against gravity (see `hoverSpeed`) while the gauge drains,
 *   and it keeps firing while the key stays held, also once it climbs; an empty gauge
 *   falls normally. On the ground the gauge refills over `rechargeTime`.
 * - A `hopHeight` above 0 (a vehicle's drift hop) makes a drift-key press on the ground
 *   hop that high, under the same gravity.
 * - In the air, gravity pulls the feet down (`fallGravity` × while falling) until they
 *   meet the ground. Without `jump` the default arc's gravity still drives falls.
 * - A jump from the ground leaves along `slope` (the ground's gradient there) as far as
 *   `jump.slopeRatio` says: part of its speed goes sideways (`vx` / `vy`, see
 *   `pushInAir`) until it lands.
 */
export function stepVertical(
	pose: CharacterPose,
	timers: JumpTimers,
	input: MoveInput,
	dt: number,
	ground: number,
	maxStep: number,
	jump: JumpParams | null,
	hopHeight = 0,
	slope: { x: number; y: number } = FLAT,
): { pose: CharacterPose; timers: JumpTimers } {
	if (dt <= 0) return { pose, timers };
	let { z, vz, vx, vy, airborne, hoverGauge } = pose;
	let hovering = false;
	let { sinceGround, sincePress, jumped, cut, airJumpsUsed } = timers;

	if (!airborne) {
		if (z - ground > Math.max(0, maxStep)) {
			airborne = true; // walked off a cliff: fall
			vz = 0;
		} else {
			z = ground;
			jumped = false; // e.g. teleported mid-jump
			cut = false;
			airJumpsUsed = 0;
		}
	} else if (z < ground) {
		z = ground; // reached a ledge within the step mid-air: stand on its edge
	}
	sinceGround = airborne ? sinceGround + dt : 0;

	const arc = jumpArc(jump ?? DEFAULT_JUMP);
	if (hopHeight > 0 && input.driftPressed && !airborne) {
		// A drift hop: spends the ground jump (no coyote jump after it), never cut short.
		airborne = true;
		vz = Math.sqrt(2 * arc.gravity * hopHeight);
		jumped = true;
		cut = true;
	}
	const hover = jump?.hover ?? null;
	if (jump) {
		sincePress = input.jumpPressed ? 0 : sincePress + dt;
		const fromGround = !airborne || (!jumped && sinceGround <= jump.coyoteTime);
		if (sincePress <= jump.bufferTime && fromGround) {
			airborne = true;
			({ vx, vy, vz } = takeoffVelocity(arc.speed, slope, jump.slopeRatio));
			jumped = true;
			cut = false;
			sincePress = Number.POSITIVE_INFINITY;
		} else if (input.jumpPressed && airborne && airJumpsUsed < Math.max(0, jump.airJumps)) {
			vz = airJumpSpeed(arc.speed, jump.airJumpRatio);
			airJumpsUsed++;
			jumped = true;
			cut = false;
			sincePress = Number.POSITIVE_INFINITY;
		} else if (jumped && !cut && vz > 0 && !input.jump) {
			vz *= Math.min(1, Math.max(0, jump.releaseCut));
			cut = true;
		}
		// Hover: the air jumps used up, the key held, falling (or already hovering: a thrust
		// above gravity climbs), and gauge left.
		hovering =
			hover !== null &&
			airborne &&
			airJumpsUsed >= Math.max(0, jump.airJumps) &&
			input.jump === true &&
			(vz <= 0 || pose.hovering) &&
			hoverGauge > 0;
	} else {
		sincePress = Number.POSITIVE_INFINITY;
	}

	if (hovering && hover) {
		vz = hoverSpeed(vz, dt, arc.gravity, hover);
		z += vz * dt;
		hoverGauge = drainHoverGauge(hoverGauge, dt, hover);
	} else if (airborne) {
		const gravity = vz > 0 ? arc.gravity : arc.gravity * (jump ?? DEFAULT_JUMP).fallGravity;
		vz -= gravity * dt;
		z += vz * dt;
	}
	if (airborne && z <= ground) {
		z = ground;
		vz = 0;
		vx = 0;
		vy = 0;
		airborne = false;
		hovering = false;
		jumped = false;
		cut = false;
		airJumpsUsed = 0;
		sinceGround = 0;
	}
	// The gauge refills only on the ground; with hover off it stays full.
	if (!hover) hoverGauge = 1;
	else if (!airborne) hoverGauge = rechargeHoverGauge(hoverGauge, dt, hover);

	const nextTimers =
		sinceGround === timers.sinceGround &&
		sincePress === timers.sincePress &&
		jumped === timers.jumped &&
		cut === timers.cut &&
		airJumpsUsed === timers.airJumpsUsed
			? timers
			: { sinceGround, sincePress, jumped, cut, airJumpsUsed };
	const nextPose =
		z === pose.z &&
		vz === pose.vz &&
		vx === pose.vx &&
		vy === pose.vy &&
		airborne === pose.airborne &&
		hovering === pose.hovering &&
		hoverGauge === pose.hoverGauge
			? pose
			: { ...pose, z, vz, vx, vy, airborne, hovering, hoverGauge };
	return { pose: nextPose, timers: nextTimers };
}

/** An angle in degrees wrapped to −180 … 180. */
function wrapAngle(deg: number): number {
	const w = wrapDeg(deg);
	return w === -180 ? 180 : w;
}

/**
 * Whether the drift key turns the steering into a roll this step: a vehicle in the air
 * with spinning on and the key held.
 */
function rollsInAir(input: MoveInput, pose: CharacterPose, spinRate: number): boolean {
	return pose.airborne && spinRate > 0 && input.drift === true;
}

/**
 * The input for the horizontal step of a vehicle in the air: while the drift key rolls
 * the body (see {@link stepAirSpin}) the steering doesn't also yaw it.
 */
export function holdSteerForRoll(
	input: MoveInput,
	pose: CharacterPose,
	spinRate: number,
): MoveInput {
	if (!rollsInAir(input, pose, spinRate)) return input;
	return { ...input, left: false, right: false, steer: undefined };
}

/**
 * Turn a vehicle's body in the air for `dt` seconds: the throttle (forward = nose down,
 * back = nose up) pitches it, and the steering rolls it while the drift key is held
 * (right = right side down), each toward `spinRate` degrees / s. With `spinInertia`
 * (seconds) the spin builds up over that long and a released one slows to a stop over it
 * (it keeps turning a while); without, the body turns only while a key is held. The angles
 * wrap, so a full flip comes round to 0. Unchanged on the ground. Pure.
 */
export function stepAirSpin(
	pose: CharacterPose,
	input: MoveInput,
	dt: number,
	spinRate: number,
	spinInertia = 0,
): CharacterPose {
	if (!pose.airborne || !(spinRate > 0) || !(dt > 0)) return pose;
	const pitchTo = -inputThrottle(input) * spinRate;
	const rollTo = rollsInAir(input, pose, spinRate) ? inputSteer(input) * spinRate : 0;
	const inertial = spinInertia > 0 && Number.isFinite(spinInertia);
	const step = inertial ? (spinRate / spinInertia) * dt : Number.POSITIVE_INFINITY;
	const pitchRate = inertial ? approach(pose.pitchRate, pitchTo, step) : pitchTo;
	const rollRate = inertial ? approach(pose.rollRate, rollTo, step) : rollTo;
	if (pitchRate === 0 && rollRate === 0 && pose.pitchRate === 0 && pose.rollRate === 0) {
		return pose;
	}
	// With inertia the mean rate over the step (exact for a steady change of rate).
	const pitchBy = (inertial ? (pose.pitchRate + pitchRate) / 2 : pitchRate) * dt;
	const rollBy = (inertial ? (pose.rollRate + rollRate) / 2 : rollRate) * dt;
	return {
		...pose,
		pitch: wrapAngle(pose.pitch + pitchBy),
		roll: wrapAngle(pose.roll + rollBy),
		pitchRate,
		rollRate,
	};
}

/**
 * How far (degrees, 0 … 180) a body at `pitch` / `roll` is tilted from ground whose
 * gradient is `slope` (rise per world unit) under a car heading `heading`: the angle
 * between the body's up and the ground's normal. Pure.
 */
export function landingTilt(
	pitch: number,
	roll: number,
	heading: number,
	slope: { x: number; y: number },
): number {
	const p = (pitch * Math.PI) / 180;
	const r = (roll * Math.PI) / 180;
	// The body's up in the car's frame (x right, y back, z up): rolled, then pitched.
	const up = { x: Math.sin(r), y: Math.cos(r) * Math.sin(p), z: Math.cos(r) * Math.cos(p) };
	// The ground's rise ahead and to the right, and its normal in the same frame.
	const f = headingVector(heading);
	const ahead = slope.x * f.x + slope.y * f.y;
	const right = slope.x * -f.y + slope.y * f.x;
	const len = Math.hypot(right, ahead, 1);
	const dot = (up.x * -right + up.y * ahead + up.z) / len;
	return (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
}

/**
 * On the step a vehicle lands (`prev` airborne, `next` on the ground), set the body back
 * on its wheels: within `landingTolerance` of the ground under it (`slope`) it drives on,
 * beyond it keeps only `crashSpeed` of its speed — judged only with spinning on
 * (`spinRate` > 0). Its attitude is 0 on the ground in any case. Unchanged in the air. Pure.
 */
export function landVehicle(
	prev: CharacterPose,
	next: CharacterPose,
	slope: { x: number; y: number },
	jump: Pick<JumpParams, "spinRate" | "landingTolerance" | "crashSpeed">,
): CharacterPose {
	if (next.airborne) return next;
	const level = next.pitch === 0 && next.roll === 0 && next.pitchRate === 0 && next.rollRate === 0;
	const landed = level ? next : { ...next, pitch: 0, roll: 0, pitchRate: 0, rollRate: 0 };
	// Only a body the keys could turn is judged (with spinning off it can't be lined up).
	if (!prev.airborne || !(jump.spinRate > 0)) return landed;
	const tilt = landingTilt(next.pitch, next.roll, next.heading, slope);
	if (tilt <= Math.max(0, jump.landingTolerance)) return landed;
	const keep = Math.min(1, Math.max(0, Number.isFinite(jump.crashSpeed) ? jump.crashSpeed : 1));
	const speed = next.speed * keep;
	return {
		...landed,
		speed,
		moving: speed !== 0,
		moveVx: next.moveVx * keep,
		moveVy: next.moveVy * keep,
	};
}

/**
 * The input for the horizontal step on a frame that may start a drift hop: the press
 * that hops doesn't also start the drift (it would carry through the air), so the drift
 * begins on landing if the key is still held and steering.
 */
export function holdDriftForHop(
	input: MoveInput,
	pose: CharacterPose,
	hopHeight: number,
): MoveInput {
	return hopHeight > 0 && input.driftPressed && !pose.airborne && input.drift
		? { ...input, drift: false }
		: input;
}

/** An air jump's take-off speed: the same gravity reaches `ratio` × the height. */
export function airJumpSpeed(takeoffSpeed: number, ratio: number): number {
	return takeoffSpeed * Math.sqrt(Math.max(0, Number.isFinite(ratio) ? ratio : 0));
}

/**
 * The vertical speed after `dt` seconds of hovering from `vz`: the thrust (× `gravity`)
 * against gravity, so the speed changes by (thrust − 1) × gravity per second, kept
 * between −`fallSpeed` (a faster fall is caught at once) and `riseSpeed`.
 */
export function hoverSpeed(vz: number, dt: number, gravity: number, hover: HoverParams): number {
	const thrust = Number.isFinite(hover.thrust) ? Math.max(0, hover.thrust) : 0;
	const next = vz + (thrust - 1) * gravity * dt;
	return Math.min(Math.max(0, hover.riseSpeed), Math.max(-Math.max(0, hover.fallSpeed), next));
}

/** The hover gauge after `dt` seconds of hovering (a full gauge lasts `duration`). */
export function drainHoverGauge(gauge: number, dt: number, hover: HoverParams): number {
	if (!(hover.duration > 0)) return 0;
	return Math.max(0, gauge - dt / hover.duration);
}

/** The hover gauge after `dt` seconds on the ground (empty → full in `rechargeTime`). */
export function rechargeHoverGauge(gauge: number, dt: number, hover: HoverParams): number {
	if (!(hover.rechargeTime > 0)) return 1;
	return Math.min(1, gauge + dt / hover.rechargeTime);
}

/** Vehicle speed after a step of throttle (1), reverse (-1) or coasting (0). */
function throttledSpeed(speed: number, throttle: number, dt: number, params: MotionParams): number {
	if (throttle > 0) {
		// Partial (analog) throttle aims for that fraction of the top speed; easing off
		// above it slows down like coasting. Braking from reverse uses friction + throttle
		// for a snappier stop.
		const target = params.moveSpeed * throttle;
		let accel = params.acceleration;
		if (speed < 0) accel = params.acceleration + params.friction;
		else if (speed > target && throttle < 1) accel = params.friction;
		return approach(speed, target, accel * dt);
	}
	if (throttle < 0) {
		const target = params.moveSpeed * params.reverseRatio * throttle;
		let accel = params.acceleration;
		if (speed > 0) accel = params.acceleration + params.friction;
		else if (speed < target && throttle > -1) accel = params.friction;
		return approach(speed, target, accel * dt);
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
