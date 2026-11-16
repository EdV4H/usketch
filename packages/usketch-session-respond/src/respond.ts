import type { SessionConfig } from "@edv4h/usketch-session-protocol";

/**
 * The `respond` session type: the host asks a question, everyone answers on
 * their own, and the answers are shown together when the host reveals them.
 * Pure model (types + functions); the rules live in `server.ts`, the per-client
 * behaviour in `client.ts`, the layout helper in `arrange.ts`.
 */
export const RESPOND_TYPE = "respond";

/** Longest prompt and part, and the default longest answer, in UTF-16 code units. */
export const RESPOND_MAX_TEXT = 280;
/** The most `maxText` can be set to. */
export const RESPOND_MAX_TEXT_LIMIT = 2000;
/** The most `maxParts` can be set to. */
export const RESPOND_MAX_PARTS_LIMIT = 50;
/** Longest tag accepted. */
export const RESPOND_MAX_TAG = 64;
/** Without being ended, a session still counts as over after this long. */
export const RESPOND_MAX_MS = 3 * 60 * 60 * 1000;

/** One piece of an answer (a line someone picked out of what they wrote…). */
export interface RespondPart {
	/** Up to {@link RESPOND_MAX_TEXT}. */
	text: string;
	/** Optional label, like {@link RespondAnswer.tag}. */
	tag?: string;
}

/** One person's answer. */
export interface RespondAnswer {
	userId: string;
	text: string;
	/**
	 * Optional label the host defines the meaning of (a mood, a category…).
	 * Used to group answers when arranging them.
	 */
	tag?: string;
	/**
	 * Optional pieces of the answer, each with its own label, when the session
	 * allows them ({@link RespondPublic.maxParts}). {@link flattenResponseParts}
	 * turns them into one item each for arranging.
	 */
	parts?: RespondPart[];
}

/** The session's public state. */
export interface RespondPublic {
	type: typeof RESPOND_TYPE;
	/** The question everyone answers. */
	prompt: string;
	/** Longest answer text accepted (default {@link RESPOND_MAX_TEXT}). */
	maxText: number;
	/** Most parts an answer may have (default 0 = answers have no parts). */
	maxParts: number;
	/** Display name of whoever started it. */
	hostName: string;
	/** Creator's clock. */
	startedAt: number;
	/** Safety net: past this it counts as over even if nobody ends it. */
	expiresAt: number;
	/** Who has answered, in the order they first answered (answers stay hidden). */
	answeredUserIds: string[];
	/** Whether the host has revealed the answers (no more answering after that). */
	revealed: boolean;
	/** Everyone's answers, in the order they first answered. Empty until revealed. */
	answers: RespondAnswer[];
}

/** Answers before they are revealed. Kept out of the public state. */
export interface RespondSecret {
	answers: RespondAnswer[];
}

/** This client's own answer (`privateFor`). */
export interface RespondPrivate {
	mine: RespondAnswer | null;
}

export type RespondConfig = SessionConfig & {
	type: typeof RESPOND_TYPE;
	prompt: string;
	maxText?: number;
	maxParts?: number;
	hostName: string;
	startedAt: number;
	expiresAt: number;
};

export type RespondAction =
	| { kind: "submit"; text: string; tag?: string; parts?: RespondPart[] }
	| { kind: "retract" };

export interface RespondStartInput {
	prompt: string;
	hostName?: string;
	/** Longest answer, 1–{@link RESPOND_MAX_TEXT_LIMIT}. Default {@link RESPOND_MAX_TEXT}. */
	maxText?: number;
	/** Most parts per answer, 0–{@link RESPOND_MAX_PARTS_LIMIT}. Default 0. */
	maxParts?: number;
}

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const cleanText = (v: unknown, max: number): string | undefined => {
	if (typeof v !== "string") return undefined;
	const text = v.trim();
	return text !== "" && text.length <= max ? text : undefined;
};

/** A whole number within [min, max], else `fallback`. */
const cleanInt = (v: unknown, min: number, max: number, fallback: number): number =>
	isFiniteNumber(v) && Number.isInteger(v) && v >= min && v <= max ? v : fallback;

const parsePart = (v: unknown): RespondPart | null => {
	if (!v || typeof v !== "object") return null;
	const r = v as Record<string, unknown>;
	const text = cleanText(r.text, RESPOND_MAX_TEXT);
	if (!text) return null;
	if (r.tag !== undefined && !cleanText(r.tag, RESPOND_MAX_TAG)) return null;
	const tag = cleanText(r.tag, RESPOND_MAX_TAG);
	return { text, ...(tag ? { tag } : {}) };
};

/** Every part valid and at most the limit, else `null`. */
const parseParts = (v: unknown): RespondPart[] | null => {
	if (!Array.isArray(v) || v.length > RESPOND_MAX_PARTS_LIMIT) return null;
	const parts = v.map(parsePart);
	return parts.every((p): p is RespondPart => p !== null) ? parts : null;
};

/** The create config for starting now. `null` when the prompt is empty. */
export function createRespondConfig(input: RespondStartInput, now: number): RespondConfig | null {
	const prompt = cleanText(input.prompt, RESPOND_MAX_TEXT);
	if (!prompt) return null;
	return {
		type: RESPOND_TYPE,
		prompt,
		maxText: cleanInt(input.maxText, 1, RESPOND_MAX_TEXT_LIMIT, RESPOND_MAX_TEXT),
		maxParts: cleanInt(input.maxParts, 0, RESPOND_MAX_PARTS_LIMIT, 0),
		hostName: input.hostName ?? "",
		startedAt: now,
		expiresAt: now + RESPOND_MAX_MS,
	};
}

const parseAnswer = (v: unknown): RespondAnswer | null => {
	if (!v || typeof v !== "object") return null;
	const r = v as Record<string, unknown>;
	const text = cleanText(r.text, RESPOND_MAX_TEXT_LIMIT);
	if (typeof r.userId !== "string" || r.userId === "" || !text) return null;
	const tag = cleanText(r.tag, RESPOND_MAX_TAG);
	const parts = r.parts === undefined ? null : parseParts(r.parts);
	return {
		userId: r.userId,
		text,
		...(tag ? { tag } : {}),
		...(parts && parts.length > 0 ? { parts } : {}),
	};
};

const parseAnswers = (v: unknown): RespondAnswer[] =>
	Array.isArray(v) ? v.map(parseAnswer).filter((a): a is RespondAnswer => a !== null) : [];

/**
 * Read a public state written by any peer. Broken values give `null`; broken
 * answers are dropped.
 */
export function parseRespond(raw: unknown): RespondPublic | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	if (!isFiniteNumber(r.startedAt) || !isFiniteNumber(r.expiresAt)) return null;
	const prompt = cleanText(r.prompt, RESPOND_MAX_TEXT);
	if (!prompt) return null;
	return {
		type: RESPOND_TYPE,
		prompt,
		maxText: cleanInt(r.maxText, 1, RESPOND_MAX_TEXT_LIMIT, RESPOND_MAX_TEXT),
		maxParts: cleanInt(r.maxParts, 0, RESPOND_MAX_PARTS_LIMIT, 0),
		hostName: typeof r.hostName === "string" ? r.hostName : "",
		startedAt: r.startedAt,
		expiresAt: r.expiresAt,
		answeredUserIds: Array.isArray(r.answeredUserIds)
			? r.answeredUserIds.filter((id): id is string => typeof id === "string")
			: [],
		revealed: r.revealed === true,
		answers: parseAnswers(r.answers),
	};
}

/** Read an action. `null` for anything that is not a valid action. */
export function parseRespondAction(raw: unknown): RespondAction | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	if (r.kind === "retract") return { kind: "retract" };
	if (r.kind !== "submit") return null;
	const text = cleanText(r.text, RESPOND_MAX_TEXT_LIMIT);
	if (!text) return null;
	if (r.tag !== undefined && !cleanText(r.tag, RESPOND_MAX_TAG)) return null;
	const tag = cleanText(r.tag, RESPOND_MAX_TAG);
	let parts: RespondPart[] | null = null;
	if (r.parts !== undefined) {
		parts = parseParts(r.parts);
		if (!parts) return null;
	}
	return {
		kind: "submit",
		text,
		...(tag ? { tag } : {}),
		...(parts && parts.length > 0 ? { parts } : {}),
	};
}

/**
 * One item per part: an answer with parts becomes one answer per part (its own
 * text and tag, the same `userId`), an answer without parts stays as it is. The
 * order follows the answers, then the parts. Feed the result to
 * `arrangeResponses` to place each part on its own. Pure.
 */
export function flattenResponseParts(answers: readonly RespondAnswer[]): RespondAnswer[] {
	return answers.flatMap((a) =>
		a.parts && a.parts.length > 0
			? a.parts.map((p) => ({ userId: a.userId, text: p.text, ...(p.tag ? { tag: p.tag } : {}) }))
			: [{ userId: a.userId, text: a.text, ...(a.tag ? { tag: a.tag } : {}) }],
	);
}

export const isRespondLive = (r: RespondPublic, now: number): boolean => now < r.expiresAt;
