import type { SessionConfig } from "@edv4h/usketch-session-protocol";

/**
 * The `gather` session type: someone starts it and everyone on the board comes
 * to one place — including people who open the board while it runs. Pure model
 * (types + functions); the camera lives in `camera.ts`, the per-client behaviour
 * in `client.ts`.
 */
export const GATHER_TYPE = "gather";

/**
 * How firmly participants are held.
 * - `gather`: brought there once, then free to move
 * - `stay`: kept inside the place until they step away
 */
export type GatherHold = "gather" | "stay";
export const GATHER_HOLDS: readonly GatherHold[] = ["gather", "stay"];

/** World-space rectangle. */
export interface GatherRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Where to gather. `rect` is the area when it started and is always present;
 * `shapeId`, when set, follows that shape (a frame) while it exists. `pageId`
 * names the page on a multi-page board.
 */
export interface GatherTarget {
	rect: GatherRect;
	shapeId?: string;
	pageId?: string;
}

/**
 * What to show behind the host's start effect / event screen. Both are optional;
 * the host decides how to draw them (e.g. the image over the color).
 */
export interface GatherBackdrop {
	/** Hex color: `#rgb`, `#rrggbb` or `#rrggbbaa`. */
	color?: string;
	/** An http(s) image URL. */
	imageUrl?: string;
}

/** The session's public state (also its create config, minus the `type` key). */
export interface GatherPublic {
	type: typeof GATHER_TYPE;
	hold: GatherHold;
	target: GatherTarget;
	/** Display name of whoever started it. */
	hostName: string;
	/** Optional heading ("Write your KPT"). */
	title?: string;
	/** Optional prompt or question for everyone ("How do you feel about the new process?"). */
	prompt?: string;
	/** Optional backdrop for the host's UI. */
	backdrop?: GatherBackdrop;
	/**
	 * Ask hosts to let participants only look and react while they take part
	 * (no editing). The session does not enforce it; each host's UI does. Never
	 * applies to whoever started it. See `isViewOnlyForMe`.
	 */
	viewOnly?: boolean;
	/**
	 * Who is asked to take part (user ids). Omitted = everyone on the board.
	 * Whoever started it always takes part. Others are left out entirely: no
	 * invitation, no camera move, not counted. See `isGatherAudience`.
	 */
	audience?: readonly string[];
	/** Creator's clock. */
	startedAt: number;
	/** End of the time limit, when there is one. */
	endsAt?: number;
	/** Safety net: past this it counts as over even if nobody ends it. */
	expiresAt: number;
}

export type GatherConfig = SessionConfig &
	Omit<GatherPublic, "type"> & { type: typeof GATHER_TYPE };

/** Without a time limit, a gathering still counts as over after this long. */
export const GATHER_MAX_MS = 3 * 60 * 60 * 1000;
/** Countdown before people already on the board are moved. */
export const GATHER_COUNTDOWN_MS = 3000;

/** At most this many user ids in `audience` (the rest are dropped). */
export const GATHER_MAX_AUDIENCE = 500;

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const parseRect = (v: unknown): GatherRect | null => {
	if (!v || typeof v !== "object") return null;
	const { x, y, width, height } = v as Record<string, unknown>;
	if (
		!isFiniteNumber(x) ||
		!isFiniteNumber(y) ||
		!isFiniteNumber(width) ||
		!isFiniteNumber(height) ||
		width <= 0 ||
		height <= 0
	) {
		return null;
	}
	return { x, y, width, height };
};

const nonEmpty = (v: unknown): string | undefined =>
	typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const MAX_URL_LENGTH = 2048;

const parseImageUrl = (v: unknown): string | undefined => {
	if (typeof v !== "string") return undefined;
	const raw = v.trim();
	if (raw.length > MAX_URL_LENGTH) return undefined;
	try {
		const url = new URL(raw);
		if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
		// 正規化で伸びる (空白が %20 になるなど) ので、配る値の長さで見る
		return url.href.length <= MAX_URL_LENGTH ? url.href : undefined;
	} catch {
		return undefined;
	}
};

/**
 * Non-empty, distinct user ids (at most {@link GATHER_MAX_AUDIENCE}). Not a list
 * gives `undefined` (everyone); a list with no valid id gives `[]` (only the host).
 */
export function parseGatherAudience(v: unknown): string[] | undefined {
	if (!Array.isArray(v)) return undefined;
	const ids = new Set<string>();
	for (const id of v) {
		if (ids.size >= GATHER_MAX_AUDIENCE) break;
		const trimmed = nonEmpty(id);
		if (trimmed) ids.add(trimmed);
	}
	return [...ids];
}

/** Keep only the valid parts; nothing valid gives `undefined`. */
export function parseGatherBackdrop(v: unknown): GatherBackdrop | undefined {
	if (!v || typeof v !== "object") return undefined;
	const r = v as Record<string, unknown>;
	const color =
		typeof r.color === "string" && HEX_COLOR.test(r.color.trim()) ? r.color.trim() : undefined;
	const imageUrl = parseImageUrl(r.imageUrl);
	if (!color && !imageUrl) return undefined;
	return { ...(color ? { color } : {}), ...(imageUrl ? { imageUrl } : {}) };
}

/**
 * Read a config / public state written by any peer. Broken values give `null`;
 * an unknown hold (from a newer client) reads as `stay`.
 */
export function parseGather(raw: unknown): GatherPublic | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	if (!isFiniteNumber(r.startedAt) || !isFiniteNumber(r.expiresAt)) return null;
	const target = r.target as Record<string, unknown> | undefined;
	const rect = parseRect(target?.rect);
	if (!rect) return null;
	const shapeId = nonEmpty(target?.shapeId);
	const pageId = nonEmpty(target?.pageId);
	const title = nonEmpty(r.title);
	const prompt = nonEmpty(r.prompt);
	const backdrop = parseGatherBackdrop(r.backdrop);
	const audience = parseGatherAudience(r.audience);
	return {
		type: GATHER_TYPE,
		hold: r.hold === "gather" ? "gather" : "stay",
		target: { rect, ...(shapeId ? { shapeId } : {}), ...(pageId ? { pageId } : {}) },
		hostName: typeof r.hostName === "string" ? r.hostName : "",
		...(title ? { title } : {}),
		...(prompt ? { prompt } : {}),
		...(backdrop ? { backdrop } : {}),
		...(r.viewOnly === true ? { viewOnly: true } : {}),
		...(audience ? { audience } : {}),
		startedAt: r.startedAt,
		...(isFiniteNumber(r.endsAt) ? { endsAt: r.endsAt } : {}),
		expiresAt: r.expiresAt,
	};
}

export interface GatherStartInput {
	hold: GatherHold;
	target: GatherTarget;
	hostName?: string;
	title?: string;
	prompt?: string;
	backdrop?: GatherBackdrop;
	/** Participants only look and react while they take part. */
	viewOnly?: boolean;
	/** Ask only these people (user ids). Omitted = everyone. */
	audience?: readonly string[];
	/** Time limit in minutes. 0 or omitted = none. */
	durationMinutes?: number;
}

/** The create config for starting a gathering now. */
export function createGatherConfig(input: GatherStartInput, now: number): GatherConfig {
	const minutes = input.durationMinutes ?? 0;
	const title = nonEmpty(input.title);
	const prompt = nonEmpty(input.prompt);
	const backdrop = parseGatherBackdrop(input.backdrop);
	const audience = parseGatherAudience(input.audience);
	const { shapeId, pageId } = input.target;
	return {
		type: GATHER_TYPE,
		hold: input.hold,
		target: {
			rect: { ...input.target.rect },
			...(shapeId ? { shapeId } : {}),
			...(pageId ? { pageId } : {}),
		},
		hostName: input.hostName ?? "",
		...(title ? { title } : {}),
		...(prompt ? { prompt } : {}),
		...(backdrop ? { backdrop } : {}),
		...(input.viewOnly ? { viewOnly: true } : {}),
		...(audience ? { audience } : {}),
		startedAt: now,
		...(minutes > 0 ? { endsAt: now + minutes * 60_000 } : {}),
		expiresAt: now + GATHER_MAX_MS,
	};
}

/** When it ends: the time limit or the safety net, whichever is first. */
export const gatherEndAt = (g: GatherPublic): number =>
	g.endsAt === undefined ? g.expiresAt : Math.min(g.endsAt, g.expiresAt);

export const isGatherLive = (g: GatherPublic, now: number): boolean => now < gatherEndAt(g);

/** Time left under the time limit, or `null` without one. */
export const gatherRemainingMs = (g: GatherPublic, now: number): number | null =>
	g.endsAt === undefined ? null : Math.max(0, g.endsAt - now);

/**
 * This client's relation to a gathering.
 * - `invited`: asked whether to take part (with `confirmJoin`); waiting for the answer
 * - `countdown`: moving shortly (it started while the board was open, or the
 *   person just accepted and the host plays an intro first)
 * - `joined`: taking part (held inside the place under `stay`)
 * - `away`: stepped away, declined, or could not be moved automatically
 */
export type GatherParticipation = "invited" | "countdown" | "joined" | "away";

/**
 * The state when this client first sees a gathering.
 * - the host started it, so is already there (and is never held)
 * - when the camera must not move (presenting, driving) or the board was opened
 *   through a deep link onto a running one, start away; the user joins from the host's UI
 * - with `confirm`, everyone else is asked first
 * - otherwise a gathering already running when the board opened joins at once,
 *   and one that starts while the board is open counts down first
 */
export function initialParticipation(args: {
	isHost: boolean;
	canAutoMove: boolean;
	seenOnLoad: boolean;
	startAway: boolean;
	/** Ask before taking part (`confirmJoin`). */
	confirm?: boolean;
	gather: GatherPublic;
	now: number;
}): GatherParticipation {
	if (args.isHost) return "joined";
	if (!args.canAutoMove) return "away";
	if (args.seenOnLoad && args.startAway) return "away";
	if (args.confirm) return "invited";
	if (args.seenOnLoad) return "joined";
	return args.now - args.gather.startedAt >= GATHER_COUNTDOWN_MS ? "joined" : "countdown";
}

/**
 * Whether this person is asked to take part: there is no `audience` (everyone),
 * they started it, or they are listed.
 */
export const isGatherAudience = (
	g: Pick<GatherPublic, "audience">,
	userId: string,
	isHost: boolean,
): boolean => isHost || g.audience === undefined || g.audience.includes(userId);

/**
 * Whether this client should be limited to looking and reacting now: the
 * gathering asks for it (`viewOnly`), this client did not start it, and it is
 * taking part or about to (`countdown` / `joined`). Invited or away people are free.
 */
export const isViewOnlyForMe = (args: {
	gather: GatherPublic | null;
	isHost: boolean;
	participation: GatherParticipation | null;
}): boolean =>
	args.gather?.viewOnly === true &&
	!args.isHost &&
	(args.participation === "joined" || args.participation === "countdown");

/**
 * Countdown left. `startedAt` is the host's clock; clamp to 0…3 s so a skewed
 * clock never makes anyone wait longer.
 */
export const countdownRemainingMs = (g: GatherPublic, now: number): number =>
	Math.min(GATHER_COUNTDOWN_MS, Math.max(0, g.startedAt + GATHER_COUNTDOWN_MS - now));
