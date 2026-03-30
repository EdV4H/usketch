/**
 * Tessellate a polyline into a triangle strip for GPU rendering.
 * Each segment becomes a quad (2 triangles) with the given half-width.
 *
 * Returns interleaved vertex data: [x, y, colorR, colorG, colorB, colorA, opacity] per vertex.
 * Vertices are ordered as a triangle strip.
 */
export function tessellatePolyline(
	points: Float32Array,
	halfWidth: number,
	color: [number, number, number, number],
	opacity: number,
): { vertices: Float32Array; vertexCount: number } {
	const pointCount = points.length / 2;
	if (pointCount < 2) {
		return { vertices: new Float32Array(0), vertexCount: 0 };
	}

	// 7 floats per vertex: x, y, r, g, b, a, opacity
	const FLOATS_PER_VERTEX = 7;
	// 2 vertices per point (left + right of the line)
	const vertices = new Float32Array(pointCount * 2 * FLOATS_PER_VERTEX);
	let vi = 0;

	for (let i = 0; i < pointCount; i++) {
		const px = points[i * 2];
		const py = points[i * 2 + 1];

		// Compute normal direction
		let nx = 0;
		let ny = 0;

		if (i === 0) {
			// First point: use direction to next point
			const dx = points[2] - points[0];
			const dy = points[3] - points[1];
			const len = Math.sqrt(dx * dx + dy * dy) || 1;
			nx = -dy / len;
			ny = dx / len;
		} else if (i === pointCount - 1) {
			// Last point: use direction from prev point
			const dx = points[i * 2] - points[(i - 1) * 2];
			const dy = points[i * 2 + 1] - points[(i - 1) * 2 + 1];
			const len = Math.sqrt(dx * dx + dy * dy) || 1;
			nx = -dy / len;
			ny = dx / len;
		} else {
			// Middle points: average normals of adjacent segments (miter)
			const dx1 = px - points[(i - 1) * 2];
			const dy1 = py - points[(i - 1) * 2 + 1];
			const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) || 1;
			const nx1 = -dy1 / len1;
			const ny1 = dx1 / len1;

			const dx2 = points[(i + 1) * 2] - px;
			const dy2 = points[(i + 1) * 2 + 1] - py;
			const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;
			const nx2 = -dy2 / len2;
			const ny2 = dx2 / len2;

			nx = (nx1 + nx2) * 0.5;
			ny = (ny1 + ny2) * 0.5;
			const nlen = Math.sqrt(nx * nx + ny * ny) || 1;
			nx /= nlen;
			ny /= nlen;

			// Limit miter length to avoid spikes
			const dot = nx1 * nx + ny1 * ny;
			if (dot > 0.01) {
				const miterScale = 1.0 / dot;
				if (miterScale > 3.0) {
					nx *= 3.0 * dot;
					ny *= 3.0 * dot;
				}
			}
		}

		// Left vertex
		vertices[vi++] = px + nx * halfWidth;
		vertices[vi++] = py + ny * halfWidth;
		vertices[vi++] = color[0];
		vertices[vi++] = color[1];
		vertices[vi++] = color[2];
		vertices[vi++] = color[3];
		vertices[vi++] = opacity;

		// Right vertex
		vertices[vi++] = px - nx * halfWidth;
		vertices[vi++] = py - ny * halfWidth;
		vertices[vi++] = color[0];
		vertices[vi++] = color[1];
		vertices[vi++] = color[2];
		vertices[vi++] = color[3];
		vertices[vi++] = opacity;
	}

	return { vertices: vertices.subarray(0, vi), vertexCount: vi / FLOATS_PER_VERTEX };
}
