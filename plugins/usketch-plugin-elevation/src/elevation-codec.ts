// A chunk's deltas as text: Int16 values (quarter units), little-endian, base64. Fixed
// byte order so every client reads the same heights whatever its CPU.

/** Encode deltas (`Int16Array`, any length) as base64. Pure. */
export function encodeChunk(values: Int16Array): string {
	const bytes = new Uint8Array(values.length * 2);
	const view = new DataView(bytes.buffer);
	for (let i = 0; i < values.length; i++) view.setInt16(i * 2, values[i], true);
	let text = "";
	// In slices: `String.fromCharCode(...bytes)` on a large array overflows the stack.
	for (let i = 0; i < bytes.length; i += 0x2000) {
		text += String.fromCharCode(...bytes.subarray(i, i + 0x2000));
	}
	return btoa(text);
}

/**
 * Decode `length` deltas. `null` when `data` isn't base64 of exactly `length` values
 * (synced data could be anything): the caller treats that chunk as unedited. Pure.
 */
export function decodeChunk(data: unknown, length: number): Int16Array | null {
	if (typeof data !== "string") return null;
	let text: string;
	try {
		text = atob(data);
	} catch {
		return null;
	}
	if (text.length !== length * 2) return null;
	const out = new Int16Array(length);
	for (let i = 0; i < length; i++) {
		const lo = text.charCodeAt(i * 2);
		const hi = text.charCodeAt(i * 2 + 1);
		out[i] = (((hi << 8) | lo) << 16) >> 16;
	}
	return out;
}

/** Whether every delta is 0 (such a chunk is removed rather than stored). Pure. */
export function isEmptyChunk(values: Int16Array): boolean {
	for (let i = 0; i < values.length; i++) if (values[i] !== 0) return false;
	return true;
}
