import type { ServerSessionType } from "@edv4h/usketch-session-protocol";
import {
	parseRespond,
	parseRespondAction,
	RESPOND_MAX_TEXT,
	type RespondAction,
	type RespondConfig,
	type RespondPrivate,
	type RespondPublic,
	type RespondSecret,
} from "./respond.js";

export type {
	RespondAction,
	RespondAnswer,
	RespondConfig,
	RespondPart,
	RespondPrivate,
	RespondPublic,
	RespondSecret,
} from "./respond.js";

/** Stand-in for a config that does not parse: already over, so every client ignores it. */
const BROKEN: RespondPublic = {
	type: "respond",
	prompt: "-",
	maxText: RESPOND_MAX_TEXT,
	maxParts: 0,
	hostName: "",
	startedAt: 0,
	expiresAt: 0,
	answeredUserIds: [],
	revealed: false,
	answers: [],
};

/**
 * Rules of the `respond` session type.
 *
 * - anyone may `submit` (replacing their own answer, keeping their place) or
 *   `retract` until the answers are revealed; an answer longer than `maxText`
 *   or with more parts than `maxParts` is refused
 * - answers live in `secret`; the public state only says who has answered
 * - the host's `close` reveals: every answer moves to the public state and no
 *   more answers are taken
 *
 * Nothing needs the server: on the shared-document transport every peer can read
 * the log, but the host UI only sees answers through `privateFor` / the public
 * state, so they appear together on reveal. On a server they are truly hidden.
 */
export const respondServerType: ServerSessionType<
	RespondPublic,
	RespondSecret,
	RespondConfig,
	RespondAction
> = {
	type: "respond",

	init(config) {
		const parsed = parseRespond({ ...config, answeredUserIds: [], revealed: false, answers: [] });
		return { public: parsed ?? { ...BROKEN }, secret: { answers: [] } };
	},

	reduce(state, raw, actorUserId) {
		if (state.public.revealed) return "answers are already revealed";
		const action = parseRespondAction(raw);
		if (!action) return "invalid action";
		const { answers } = state.secret;
		const index = answers.findIndex((a) => a.userId === actorUserId);
		if (action.kind === "retract") {
			if (index < 0) return "nothing to retract";
			answers.splice(index, 1);
			state.public.answeredUserIds = state.public.answeredUserIds.filter(
				(id) => id !== actorUserId,
			);
			return undefined;
		}
		if (action.text.length > state.public.maxText) return "answer is too long";
		if ((action.parts?.length ?? 0) > state.public.maxParts) return "too many parts";
		const answer = {
			userId: actorUserId,
			text: action.text,
			...(action.tag ? { tag: action.tag } : {}),
			...(action.parts ? { parts: action.parts } : {}),
		};
		if (index >= 0) {
			answers[index] = answer;
		} else {
			answers.push(answer);
			state.public.answeredUserIds.push(actorUserId);
		}
		return undefined;
	},

	privateFor(state, userId): RespondPrivate {
		const mine = state.secret.answers.find((a) => a.userId === userId) ?? null;
		return { mine };
	},

	close(state) {
		if (state.public.revealed) return;
		state.public.revealed = true;
		state.public.answers = state.secret.answers.map((a) => ({ ...a }));
	},
};
