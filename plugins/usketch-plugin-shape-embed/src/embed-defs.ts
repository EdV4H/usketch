/**
 * Embed provider allow-list (modeled on tldraw's EMBED_DEFINITIONS). Each entry
 * maps a set of hostnames to an embeddable URL + the iframe sandbox/permissions
 * that provider needs. Unknown URLs fall back to {@link GENERIC_DEF} with a
 * strict sandbox. Add providers by passing extra definitions to the plugin.
 */

export interface EmbedDefinition {
	id: string;
	title: string;
	/** Hostnames (without www.) this definition matches. */
	hostnames: string[];
	/** Convert a shareable URL to an embeddable one, or undefined if not embeddable. */
	toEmbedUrl(url: URL): string | undefined;
	/** Preferred width/height ratio for a freshly created embed. */
	aspect?: number;
	/** iframe `sandbox` tokens. */
	sandbox: string;
	/** iframe `allow` (feature policy), e.g. for fullscreen / autoplay. */
	allow?: string;
	/** True if this provider has a synced player (see players/). */
	syncable?: boolean;
}

const stripWww = (host: string) => host.replace(/^www\./, "");

/** Extract a YouTube video id from watch/short/embed/youtu.be URLs. */
function youtubeId(u: URL): string | undefined {
	const host = stripWww(u.hostname);
	if (host === "youtu.be") return u.pathname.slice(1) || undefined;
	if (u.pathname.startsWith("/watch")) return u.searchParams.get("v") ?? undefined;
	const m = /^\/(embed|shorts|live)\/([^/?#]+)/.exec(u.pathname);
	return m ? m[2] : undefined;
}

export const YOUTUBE_DEF: EmbedDefinition = {
	id: "youtube",
	title: "YouTube",
	hostnames: ["youtube.com", "youtu.be", "youtube-nocookie.com"],
	aspect: 16 / 9,
	// enablejsapi=1 is required for the postMessage player control (watch-party sync).
	toEmbedUrl: (u) => {
		const id = youtubeId(u);
		return id ? `https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&rel=0` : undefined;
	},
	sandbox: "allow-scripts allow-same-origin allow-popups allow-presentation",
	allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
	syncable: true,
};

export const VIMEO_DEF: EmbedDefinition = {
	id: "vimeo",
	title: "Vimeo",
	hostnames: ["vimeo.com", "player.vimeo.com"],
	aspect: 16 / 9,
	toEmbedUrl: (u) => {
		const id = /(\d+)/.exec(u.pathname)?.[1];
		return id ? `https://player.vimeo.com/video/${id}` : undefined;
	},
	sandbox: "allow-scripts allow-same-origin allow-popups",
	allow: "autoplay; fullscreen; picture-in-picture",
};

export const FIGMA_DEF: EmbedDefinition = {
	id: "figma",
	title: "Figma",
	hostnames: ["figma.com"],
	aspect: 4 / 3,
	toEmbedUrl: (u) =>
		/\/(file|design|board|proto)\//.test(u.pathname)
			? `https://www.figma.com/embed?embed_host=usketch&url=${encodeURIComponent(u.href)}`
			: undefined,
	sandbox: "allow-scripts allow-same-origin allow-popups allow-forms",
	allow: "fullscreen",
};

export const GOOGLE_MAPS_DEF: EmbedDefinition = {
	id: "google-maps",
	title: "Google Maps",
	hostnames: ["google.com", "maps.google.com"],
	aspect: 4 / 3,
	toEmbedUrl: (u) =>
		u.pathname.startsWith("/maps")
			? `https://maps.google.com/maps?output=embed&q=${encodeURIComponent(u.href)}`
			: undefined,
	sandbox: "allow-scripts allow-same-origin allow-popups",
	allow: "fullscreen",
};

export const CODESANDBOX_DEF: EmbedDefinition = {
	id: "codesandbox",
	title: "CodeSandbox",
	hostnames: ["codesandbox.io"],
	aspect: 4 / 3,
	toEmbedUrl: (u) =>
		u.pathname.startsWith("/s/") || u.pathname.startsWith("/p/")
			? `https://codesandbox.io/embed/${u.pathname.replace(/^\/(s|p)\//, "")}`
			: `https://codesandbox.io/embed${u.pathname}`,
	sandbox: "allow-scripts allow-same-origin allow-popups allow-forms",
	allow: "fullscreen",
};

/** Fallback for any http(s) URL: embed as-is with a STRICT sandbox (no allow-same-origin). */
export const GENERIC_DEF: EmbedDefinition = {
	id: "generic",
	title: "Web page",
	hostnames: [],
	aspect: 4 / 3,
	toEmbedUrl: (u) => (u.protocol === "http:" || u.protocol === "https:" ? u.href : undefined),
	sandbox: "allow-scripts allow-popups allow-forms",
};

export const DEFAULT_EMBED_DEFS: EmbedDefinition[] = [
	YOUTUBE_DEF,
	VIMEO_DEF,
	FIGMA_DEF,
	GOOGLE_MAPS_DEF,
	CODESANDBOX_DEF,
];

export interface ResolvedEmbed {
	def: EmbedDefinition;
	embedUrl: string;
}

/**
 * Resolve a raw URL to an embeddable URL + its definition. Tries the provider
 * allow-list (hostname match), then the generic fallback. Returns null for
 * non-http(s) / unparseable input.
 */
export function resolveEmbed(
	rawUrl: string,
	defs: EmbedDefinition[] = DEFAULT_EMBED_DEFS,
): ResolvedEmbed | null {
	let u: URL;
	try {
		u = new URL(rawUrl);
	} catch {
		return null;
	}
	if (u.protocol !== "http:" && u.protocol !== "https:") return null;
	const host = stripWww(u.hostname);
	for (const def of defs) {
		if (def.hostnames.some((h) => host === h || host.endsWith(`.${h}`))) {
			const embedUrl = def.toEmbedUrl(u);
			if (embedUrl) return { def, embedUrl };
		}
	}
	const embedUrl = GENERIC_DEF.toEmbedUrl(u);
	return embedUrl ? { def: GENERIC_DEF, embedUrl } : null;
}
