import type { ServerSessionType } from "@edv4h/usketch-session-protocol";
import type {
	VoteCastAction,
	VotingConfig,
	VotingPrivateState,
	VotingPublicState,
	VotingSecret,
} from "./types.js";

export type {
	VoteCastAction,
	VotingConfig,
	VotingPrivateState,
	VotingPublicState,
	VotingSecret,
} from "./types.js";

function recomputeTally(pub: VotingPublicState, secret: VotingSecret): void {
	const tally = pub.options.map(() => 0);
	let voters = 0;
	for (const picks of Object.values(secret.votes)) {
		if (picks.length === 0) continue;
		voters++;
		for (const i of picks) if (i >= 0 && i < tally.length) tally[i]++;
	}
	pub.tally = tally;
	pub.totalVoters = voters;
}

/**
 * Server-authoritative voting session type. Dedups per userId, keeps who-voted-
 * what in server-only `secret` (so a secret ballot never leaks in `public`),
 * replaces the pick on single-choice re-vote / toggles it on multi.
 *
 * Registered into the Durable Object's `SessionManager` by `apps/server` — the
 * server bundle is where a type's rules must live for the model to stay
 * authoritative.
 */
export const votingServerType: ServerSessionType<
	VotingPublicState,
	VotingSecret,
	VotingConfig,
	VoteCastAction
> = {
	type: "voting",

	init(config) {
		const options = config.options.slice(0, 8); // cap
		const pub: VotingPublicState = {
			type: "voting",
			question: config.question,
			options,
			tally: options.map(() => 0),
			totalVoters: 0,
			secret: !!config.secret,
			multi: !!config.multi,
			status: "open",
		};
		return { public: pub, secret: { votes: {} } };
	},

	reduce(state, action, actorUserId) {
		const pub = state.public;
		const secret = state.secret;
		if (action.kind !== "cast") return "unknown action";
		if (pub.status === "closed") return "vote is closed";
		const i = action.optionIndex;
		if (!Number.isInteger(i) || i < 0 || i >= pub.options.length) return "invalid option";

		const cur = secret.votes[actorUserId] ?? [];
		let next: number[];
		if (pub.multi) {
			// toggle the option
			next = cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i];
		} else {
			// single choice: re-voting replaces the previous pick
			next = cur.length === 1 && cur[0] === i ? [] : [i];
		}
		if (next.length === 0) delete secret.votes[actorUserId];
		else secret.votes[actorUserId] = next;

		recomputeTally(pub, secret);
		return undefined;
	},

	privateFor(state, userId): VotingPrivateState {
		return { type: "voting", myVotes: state.secret.votes[userId] ?? [] };
	},

	close(state) {
		state.public.status = "closed";
	},
};
