import type { SessionConfig } from "@edv4h/usketch-session-protocol";

/** Voting public state — broadcast to everyone. */
export interface VotingPublicState {
	type: "voting";
	question: string;
	options: string[];
	/** Vote count per option (index-aligned with `options`). */
	tally: number[];
	/** Number of distinct users who have voted. */
	totalVoters: number;
	/** Secret ballot: the server never reveals who voted for what (only tallies). */
	secret: boolean;
	/** Whether a voter may pick multiple options. */
	multi: boolean;
	status: "open" | "closed";
}

/** Create config for a voting session. */
export interface VotingConfig extends SessionConfig {
	type: "voting";
	question: string;
	options: string[];
	secret?: boolean;
	multi?: boolean;
}

/** The only voting action: cast (or, when multi, toggle) a vote for an option. */
export interface VoteCastAction {
	kind: "cast";
	optionIndex: number;
}

/** Private view sent only to the voting user (their own picks). */
export interface VotingPrivateState {
	type: "voting";
	/** Option indexes this user has voted for. */
	myVotes: number[];
}

/** Secret (server-only) voting state: which option indexes each user picked. */
export interface VotingSecret {
	votes: Record<string, number[]>;
}
