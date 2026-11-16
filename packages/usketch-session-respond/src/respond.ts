import type { SessionConfig } from "@edv4h/usketch-session-protocol";

/**
 * The `respond` session type: the host asks a question, everyone answers on
 * their own, and the answers are shown together when the host reveals them.
 * Pure model (types + functions); the rules live in `server.ts`, the per-client
 * behaviour in `client.ts`, the layout helper in `arrange.ts`.
 */
export const RESPOND_TYPE = "respond";

/** Longest answer accepted, in UTF-16 code units. */
export const RESPOND_MAX_TEXT = 280;
/** Longest tag accepted. */
export const RESPOND_MAX_TAG = 64;
/** Without being ended, a session still counts as over after this long. */
export const RESPOND_MAX_MS = 3 * 60 * 60 * 1000;

/** One person's answer. */
export interface RespondAnswer {
	userId: string;
	text: string;
	/**
	 * Optional label the host defines the meaning of (a mood, a category…).
	 * Used to group answers when arranging them.
	 */
	tag?: string;
}

/** The session's public state. */
export interface RespondPublic {
	type: typeof RESPOND_TYPE;
	/** The question everyone answers. */
	prompt: string;
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
	hostName: string;
	startedAt: number;
	expiresAt: number;
};

export type RespondAction = { kind: "submit"; text: string; tag?: string } | { kind: "retract" };

export interface RespondStartInput {
	prompt: string;
	hostName?: string;
}

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const cleanText = (v: unknown, max: number): string | undefined => {
	if (typeof v !== "string") return undefined;
	const text = v.trim();
	return text !== "" && text.length <= max ? text : undefined;
};

/** The create config for starting now. `null` when the prompt is empty. */
export function createRespondConfig(input: RespondStartInput, now: number): RespondConfig | null {
	const prompt = cleanText(input.prompt, RESPOND_MAX_TEXT);
	if (!prompt) return null;
	return {
		type: RESPOND_TYPE,
		prompt,
		hostName: input.hostName ?? "",
		startedAt: now,
		expiresAt: now + RESPOND_MAX_MS,
	};
}

const parseAnswer = (v: unknown): RespondAnswer | null => {
	if (!v || typeof v !== "object") return null;
	const r = v as Record<string, unknown>;
	const text = cleanText(r.text, RESPOND_MAX_TEXT);
	if (typeof r.userId !== "string" || r.userId === "" || !text) return null;
	const tag = cleanText(r.tag, RESPOND_MAX_TAG);
	return { userId: r.userId, text, ...(tag ? { tag } : {}) };
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
	const text = cleanText(r.text, RESPOND_MAX_TEXT);
	if (!text) return null;
	if (r.tag !== undefined && !cleanText(r.tag, RESPOND_MAX_TAG)) return null;
	const tag = cleanText(r.tag, RESPOND_MAX_TAG);
	return { kind: "submit", text, ...(tag ? { tag } : {}) };
}

export const isRespondLive = (r: RespondPublic, now: number): boolean => now < r.expiresAt;
