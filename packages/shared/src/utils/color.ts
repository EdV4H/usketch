/** Parse a CSS color string to RGBA tuple (0-1 range). Returns null if unparseable. */
export function cssColorToRgba(color: string): [number, number, number, number] | null {
	// transparent
	if (color === "transparent" || color === "none") {
		return [0, 0, 0, 0];
	}

	// #RGB or #RRGGBB or #RRGGBBAA
	if (color.startsWith("#")) {
		const hex = color.slice(1);
		if (hex.length === 3) {
			const r = Number.parseInt(hex[0] + hex[0], 16) / 255;
			const g = Number.parseInt(hex[1] + hex[1], 16) / 255;
			const b = Number.parseInt(hex[2] + hex[2], 16) / 255;
			return [r, g, b, 1];
		}
		if (hex.length === 6) {
			const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
			const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
			const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
			return [r, g, b, 1];
		}
		if (hex.length === 8) {
			const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
			const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
			const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
			const a = Number.parseInt(hex.slice(6, 8), 16) / 255;
			return [r, g, b, a];
		}
		return null;
	}

	// rgb(r, g, b) or rgba(r, g, b, a)
	const rgbaMatch = color.match(
		/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?))?\s*\)$/,
	);
	if (rgbaMatch) {
		const r = Number.parseFloat(rgbaMatch[1]) / 255;
		const g = Number.parseFloat(rgbaMatch[2]) / 255;
		const b = Number.parseFloat(rgbaMatch[3]) / 255;
		const a = rgbaMatch[4] !== undefined ? Number.parseFloat(rgbaMatch[4]) : 1;
		return [r, g, b, a];
	}

	return null;
}

/** Parse CSS color to RGBA, returning opaque black as fallback. */
export function cssColorToRgbaOrDefault(
	color: string,
	fallback: [number, number, number, number] = [0, 0, 0, 1],
): [number, number, number, number] {
	return cssColorToRgba(color) ?? fallback;
}
