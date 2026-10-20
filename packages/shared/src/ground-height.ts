import { defineService } from "./service.js";

/**
 * A board-wide "ground height" field: how high the walkable ground stands at a world
 * point (world units, `0` = the flat board). A terrain-like plugin (e.g. the island
 * plugin's elevated islands) provides it; consumers that move things over the ground
 * (e.g. the character plugin's step limit and 3D lift) read it. Absent provider =
 * the whole board is flat.
 */
export interface GroundHeightApi {
	/** Ground height at a world point (world units, `>= 0`). */
	heightAt(x: number, y: number): number;
}

/** Typed service handle for the board's ground-height provider (one provider at a time). */
export const groundHeightService = defineService<GroundHeightApi>("usketch:ground-height");
