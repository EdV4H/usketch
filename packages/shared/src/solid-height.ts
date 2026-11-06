import { defineService } from "./service.js";

/**
 * Solids standing on the ground that a walking character can't pass through or can
 * stand on (e.g. the shape-3d plugin's walls and raised blocks). Next to
 * `groundHeightService`: a consumer that moves things over the ground (the character
 * plugin) treats the higher of the two as the ground. Absent provider = no solids.
 */
export interface SolidHeightApi {
	/**
	 * The top of the solid at a world point (world units): `null` where there is none,
	 * a finite height for a top that can be stood on (reached by the usual step / jump
	 * rules), `Infinity` for a wall that can't be passed.
	 */
	heightAt(x: number, y: number): number | null;
}

/** Typed service handle for the board's solids (one provider at a time). */
export const solidHeightService = defineService<SolidHeightApi>("usketch:solid-height");
