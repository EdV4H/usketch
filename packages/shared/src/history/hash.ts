/** Kinds of content-addressed objects in a board history. */
export type HistoryObjectKind = "blob" | "tree" | "commit";

/**
 * SHA-256 of `"<kind> <body>"` as lowercase hex.
 *
 * The kind prefix keeps a blob and a tree with byte-identical bodies from
 * sharing a hash (Git does the same). Uses Web Crypto (`crypto.subtle`), which
 * browsers, Cloudflare Workers and Node.js 19+ all expose on `globalThis`.
 */
export async function hashHistoryObject(kind: HistoryObjectKind, body: string): Promise<string> {
	const subtle = globalThis.crypto?.subtle;
	if (!subtle) {
		throw new Error("hashHistoryObject: Web Crypto (crypto.subtle) is not available");
	}
	const digest = await subtle.digest("SHA-256", new TextEncoder().encode(`${kind} ${body}`));
	let hex = "";
	for (const byte of new Uint8Array(digest)) hex += byte.toString(16).padStart(2, "0");
	return hex;
}
