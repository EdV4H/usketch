export const STICKY_COLORS: Record<string, string> = {
	yellow: "#fef08a",
	pink: "#fda4af",
	blue: "#93c5fd",
	green: "#86efac",
};

export const STICKY_COLOR_KEYS = Object.keys(STICKY_COLORS) as (keyof typeof STICKY_COLORS)[];

export const DEFAULT_STICKY_COLOR = "yellow";

export const DEFAULT_STICKY_SIZE = { width: 200, height: 200 };
