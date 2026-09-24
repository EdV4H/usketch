// Public types. The plugin owns NO visuals: it computes where each character is
// and which way it faces, then hands those props to a host-supplied renderer.
import type { ReactNode } from "react";

/** JSON-serializable look data, broadcast so other clients can draw you the same way. */
export type CharacterAppearance = Record<string, unknown>;

/** Everything a renderer needs to draw one character at its (already placed) spot. */
export interface CharacterRenderProps {
	/** `"self"` for the local character, otherwise the remote client's id. */
	id: string;
	isSelf: boolean;
	/** Facing in the world, degrees (0 = up / -y, clockwise). */
	heading: number;
	/**
	 * Apparent facing ON SCREEN = `heading + viewport.rotation`. Rotate a top-down
	 * sprite by this (`transform: rotate(${screenHeading}deg)`); a side-view sprite
	 * might instead flip on its sign.
	 */
	screenHeading: number;
	/** Whether the character is moving right now (drive walk cycles etc.). */
	moving: boolean;
	/** Signed speed along the heading, world units / s. */
	speed: number;
	/** Current viewport zoom (scale the sprite with the world, or not). */
	zoom: number;
	/** The owner's broadcast appearance. */
	appearance: CharacterAppearance;
	/** The owner's display name, if any. */
	name?: string;
}

/**
 * Draws one character. The plugin places the returned node centered on the
 * character's screen position (a zero-size, pointer-transparent wrapper).
 */
export type CharacterRenderer = (props: CharacterRenderProps) => ReactNode;

/** A remote client's character as last received (plus the smoothed display pose). */
export interface RemoteCharacter {
	id: string;
	x: number;
	y: number;
	heading: number;
	speed: number;
	moving: boolean;
	appearance: CharacterAppearance;
	name?: string;
}

/** Customizable key bindings: `KeyboardEvent.code` values per direction. */
export interface CharacterKeys {
	up: string[];
	down: string[];
	left: string[];
	right: string[];
}

export const DEFAULT_KEYS: CharacterKeys = {
	up: ["KeyW"],
	down: ["KeyS"],
	left: ["KeyA"],
	right: ["KeyD"],
};
