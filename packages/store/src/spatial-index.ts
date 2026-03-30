import type { BoundingBox } from "@edv4h/usketch-shared";

const DEFAULT_CELL_SIZE = 512;

function cellKey(cx: number, cy: number): string {
	return `${cx},${cy}`;
}

export interface SpatialIndex {
	/** Query all shape IDs whose bounds intersect the given viewport. */
	query(viewport: BoundingBox): string[];
	/** Insert a shape into the index. */
	insert(id: string, bounds: BoundingBox): void;
	/** Update an existing shape's bounds (remove + re-insert). */
	update(id: string, bounds: BoundingBox): void;
	/** Remove a shape from the index. */
	remove(id: string): void;
	/** Clear all entries. */
	clear(): void;
}

export function createSpatialIndex(cellSize = DEFAULT_CELL_SIZE): SpatialIndex {
	// cell key → set of shape IDs in that cell
	const cells = new Map<string, Set<string>>();
	// shape ID → set of cell keys it occupies
	const shapeCells = new Map<string, Set<string>>();

	function getCellRange(bounds: BoundingBox) {
		const minCx = Math.floor(bounds.x / cellSize);
		const minCy = Math.floor(bounds.y / cellSize);
		const maxCx = Math.floor((bounds.x + bounds.width) / cellSize);
		const maxCy = Math.floor((bounds.y + bounds.height) / cellSize);
		return { minCx, minCy, maxCx, maxCy };
	}

	function insertInto(id: string, bounds: BoundingBox) {
		const { minCx, minCy, maxCx, maxCy } = getCellRange(bounds);
		const keys = new Set<string>();
		for (let cx = minCx; cx <= maxCx; cx++) {
			for (let cy = minCy; cy <= maxCy; cy++) {
				const key = cellKey(cx, cy);
				keys.add(key);
				let cell = cells.get(key);
				if (!cell) {
					cell = new Set();
					cells.set(key, cell);
				}
				cell.add(id);
			}
		}
		shapeCells.set(id, keys);
	}

	function removeFrom(id: string) {
		const keys = shapeCells.get(id);
		if (!keys) return;
		for (const key of keys) {
			const cell = cells.get(key);
			if (cell) {
				cell.delete(id);
				if (cell.size === 0) cells.delete(key);
			}
		}
		shapeCells.delete(id);
	}

	return {
		query(viewport: BoundingBox): string[] {
			const { minCx, minCy, maxCx, maxCy } = getCellRange(viewport);
			const result = new Set<string>();
			for (let cx = minCx; cx <= maxCx; cx++) {
				for (let cy = minCy; cy <= maxCy; cy++) {
					const cell = cells.get(cellKey(cx, cy));
					if (cell) {
						for (const id of cell) result.add(id);
					}
				}
			}
			return [...result];
		},

		insert(id: string, bounds: BoundingBox) {
			insertInto(id, bounds);
		},

		update(id: string, bounds: BoundingBox) {
			removeFrom(id);
			insertInto(id, bounds);
		},

		remove(id: string) {
			removeFrom(id);
		},

		clear() {
			cells.clear();
			shapeCells.clear();
		},
	};
}
