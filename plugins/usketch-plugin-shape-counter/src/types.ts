import type { ShapeData } from "@edv4h/usketch-shared";

/** Counter shape extension: intrinsic data for the `counter` shape. */
export interface CounterShapeData extends ShapeData {
	count: number;
}
