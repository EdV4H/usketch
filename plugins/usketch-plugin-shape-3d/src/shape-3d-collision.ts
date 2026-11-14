// What a 3D shape blocks on the ground (`collision` in its parameters). The pure parts
// live in `@edv4h/usketch-shared` (shape-solids) now; the names here stay until the next
// major.
import {
	areaContains,
	COLLIDER_CELL,
	type ColliderArea,
	type ColliderIndex,
	colliderFor,
	MIN_STAND_RADIUS,
	type ShapeData,
	type ShapeView3dCollider,
	STAND_WALL_THICKNESS,
	buildColliderIndex as sharedColliderIndex,
	solidHeightAt,
} from "@edv4h/usketch-shared";
import type { Shape3dTypes } from "./shape-3d-params.js";

export {
	areaContains,
	COLLIDER_CELL,
	type ColliderArea,
	type ColliderIndex,
	colliderFor,
	MIN_STAND_RADIUS,
	STAND_WALL_THICKNESS,
	solidHeightAt,
};

/** A shape's collider (= `ShapeView3dCollider`). */
export type Shape3dCollider = ShapeView3dCollider;

/** Every shape's collider, bucketed in a grid so a point looks at few of them. Pure. */
export function buildColliderIndex(
	shapes: Iterable<ShapeData>,
	types: Shape3dTypes,
	cell = COLLIDER_CELL,
): ColliderIndex {
	return sharedColliderIndex(shapes, (type) => types[type], cell);
}
