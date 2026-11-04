// Non-keyboard movement input (an on-screen touch stick, a gamepad …) that a host
// feeds through `CharacterApi.setVirtualInput`. It is analog and is combined with the
// held keys each frame, so a keyboard and a touch stick can drive at the same time.
import { clampUnit, inputSteer, inputThrottle, type MoveInput } from "./character-physics.js";

/** Analog input from a host control. Missing fields count as released. */
export interface VirtualInput {
	/** Forward / back, -1 (full reverse / screen down) … 1 (full throttle / screen up). */
	throttle: number;
	/** Left / right, -1 … 1. */
	steer: number;
	/** Vehicle: the drift button (only acts when drift is enabled). */
	drift: boolean;
	/**
	 * The jump button, held (only acts while jumping is on). Holding it works like holding
	 * the jump key: a release while rising cuts the jump short, and holding it in a fall
	 * hovers. Omitted = released.
	 */
	jump?: boolean;
}

/** Clamp a host value into a `VirtualInput`; `null` (or all released) = no input. */
export function normalizeVirtualInput(input: Partial<VirtualInput> | null): VirtualInput | null {
	if (!input) return null;
	const v: VirtualInput = {
		throttle: clampUnit(input.throttle),
		steer: clampUnit(input.steer),
		drift: input.drift === true,
		jump: input.jump === true,
	};
	return isVirtualInputActive(v) ? v : null;
}

/** Whether the virtual control is being touched (moves the stick or holds a button). */
export function isVirtualInputActive(v: VirtualInput | null): boolean {
	return v !== null && (v.throttle !== 0 || v.steer !== 0 || v.drift || v.jump === true);
}

/**
 * Buttons that went down between `prev` and `next` — the press edges a step needs
 * (`jumpPressed` starts a jump, `driftPressed` a drift hop), since a quick tap can be
 * pressed and released between two frames.
 */
export function virtualPresses(
	prev: VirtualInput | null,
	next: VirtualInput | null,
): { jump: boolean; drift: boolean } {
	return {
		jump: next?.jump === true && prev?.jump !== true,
		drift: next?.drift === true && prev?.drift !== true,
	};
}

/**
 * The keys plus the virtual control: their axes add up (capped at ±1) and drift / jump
 * are held if either holds them. Without virtual input the key input passes through as
 * is. Press edges are not derived here (see `virtualPresses`).
 */
export function combineInput(keys: MoveInput, virtual: VirtualInput | null): MoveInput {
	if (!virtual) return keys;
	return {
		...keys,
		throttle: clampUnit(inputThrottle(keys) + virtual.throttle),
		steer: clampUnit(inputSteer(keys) + virtual.steer),
		drift: keys.drift === true || virtual.drift,
		jump: keys.jump === true || virtual.jump === true,
	};
}
