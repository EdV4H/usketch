import type { ServerSessionType } from "@edv4h/usketch-session-protocol";
import { type GatherConfig, type GatherPublic, parseGather } from "./gather.js";

export type { GatherConfig, GatherHold, GatherPublic, GatherRect, GatherTarget } from "./gather.js";

/** Stand-in for a config that does not parse: already over, so every client ignores it. */
const BROKEN: GatherPublic = {
	type: "gather",
	hold: "gather",
	target: { rect: { x: 0, y: 0, width: 1, height: 1 } },
	hostName: "",
	startedAt: 0,
	expiresAt: 0,
};

/**
 * Rules of the `gather` session type. Everything lives in the public state set
 * at creation; there are no actions yet and nothing is secret, so it runs on the
 * server and on the shared-document transport alike.
 */
export const gatherServerType: ServerSessionType<GatherPublic, null, GatherConfig, never> = {
	type: "gather",

	init(config) {
		return { public: parseGather(config) ?? BROKEN, secret: null };
	},

	reduce() {
		return "gather has no actions";
	},

	privateFor() {
		return null;
	},
};
