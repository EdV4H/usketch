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
}

/** Clamp a host value into a `VirtualInput`; `null` (or all released) = no input. */
export function normalizeVirtualInput(input: Partial<VirtualInput> | null): VirtualInput | null {
	if (!input) return null;
	const v: VirtualInput = {
		throttle: clampUnit(input.throttle),
		steer: clampUnit(input.steer),
		drift: input.drift === true,
	};
	return isVirtualInputActive(v) ? v : null;
}

/** Whether the virtual control is being touched (moves the stick or holds drift). */
export function isVirtualInputActive(v: VirtualInput | null): boolean {
	return v !== null && (v.throttle !== 0 || v.steer !== 0 || v.drift);
}

/**
 * The keys plus the virtual control: their axes add up (capped at ±1) and drift is
 * held if either holds it. Without virtual input the key input passes through as is.
 */
export function combineInput(keys: MoveInput, virtual: VirtualInput | null): MoveInput {
	if (!virtual) return keys;
	return {
		...keys,
		throttle: clampUnit(inputThrottle(keys) + virtual.throttle),
		steer: clampUnit(inputSteer(keys) + virtual.steer),
		drift: keys.drift === true || virtual.drift,
	};
}
