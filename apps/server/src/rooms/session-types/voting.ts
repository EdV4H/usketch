import type {
	PublicState,
	SessionAction,
	SessionConfig,
	VotingConfig,
	VotingPrivateState,
	VotingPublicState,
} from "@edv4h/usketch-session-protocol";

/**
 * Server-side session-type contract. The server owns all logic; clients only
 * render. `public` is broadcast to everyone; `secret` stays server-side and
 * feeds per-user `privateFor`. Keep `public`/`secret` JSON-serializable so the
 * DO can persist them.
 */
export interface ServerSessionType<Secret = unknown> {
	/** Build the initial public + secret state from the create config. */
	init(config: SessionConfig): { public: PublicState; secret: Secret };
	/**
	 * Apply an actor's action in place (mutate `state.public` / `state.secret`).
	 * Return an error string to reject (nothing is broadcast on error).
	 */
	reduce(
		state: { public: PublicState; secret: Secret },
		action: SessionAction,
		actorUserId: string,
	): string | undefined;
	/** The private view for one user (secret ballot receipt / own hand), or null. */
	privateFor(state: { public: PublicState; secret: Secret }, userId: string): unknown | null;
	/** Host-only "close/freeze" (e.g. stop accepting votes). Optional. */
	close?(state: { public: PublicState; secret: Secret }): void;
}

/** Secret (server-only) voting state: which option indexes each user picked. */
export interface VotingSecret {
	votes: Record<string, number[]>;
}

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

export const votingType: ServerSessionType<VotingSecret> = {
	init(config: SessionConfig) {
		const c = config as VotingConfig;
		const options = c.options.slice(0, 8); // cap
		const pub: VotingPublicState = {
			type: "voting",
			question: c.question,
			options,
			tally: options.map(() => 0),
			totalVoters: 0,
			secret: !!c.secret,
			multi: !!c.multi,
			status: "open",
		};
		return { public: pub, secret: { votes: {} } };
	},

	reduce(state, action, actorUserId) {
		const pub = state.public as VotingPublicState;
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
		const secret = state.secret;
		return { type: "voting", myVotes: secret.votes[userId] ?? [] };
	},

	close(state) {
		(state.public as VotingPublicState).status = "closed";
	},
};
