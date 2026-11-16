import type { ClientSessionType, SessionAttachContext } from "@edv4h/usketch-plugin-session";
import type { Participant, SessionView } from "@edv4h/usketch-session-protocol";
import { defineService, type ServiceRegistry } from "@edv4h/usketch-shared";
import {
	createRespondConfig,
	isRespondLive,
	parseRespond,
	RESPOND_TYPE,
	type RespondAnswer,
	type RespondPart,
	type RespondPrivate,
	type RespondPublic,
	type RespondStartInput,
} from "./respond.js";

export * from "./arrange.js";
export * from "./respond.js";

/** What the host UI shows: the running question and this client's part in it. */
export interface RespondState {
	/** The running session (the newest live one), or `null`. */
	session: SessionView | null;
	respond: RespondPublic | null;
	isHost: boolean;
	/** This client's own answer (before and after the reveal). */
	mine: RespondAnswer | null;
	/** How many people have answered. */
	answeredCount: number;
	/** Who has taken part (answered or joined), the host first. */
	participants: readonly Participant[];
}

/** Host-facing API (`getRespondApi(app.services)`) for drawing the UI. */
export interface RespondApi {
	getState(): RespondState;
	subscribe(listener: () => void): () => void;
	/** Ask a question (ends this client's own running one first). `false` for an empty prompt. */
	start(input: RespondStartInput): boolean;
	/**
	 * Answer, or replace this client's answer. `tag` is optional (a mood, a
	 * category…). `parts` only when the session allows them (`maxParts`).
	 */
	submit(text: string, tag?: string, parts?: readonly RespondPart[]): void;
	/** Take this client's answer back. */
	retract(): void;
	/** Host only: show everyone's answers and stop taking new ones. */
	reveal(): void;
	/** Host only: end it and remove it for everyone. */
	end(): void;
}

export const respondService = defineService<RespondApi>("usketch-session-respond");

export function getRespondApi(services: ServiceRegistry): RespondApi | undefined {
	return respondService.get(services);
}

export interface RespondClientOptions {
	now?: () => number;
}

const pickLive = (
	sessions: readonly SessionView[],
	now: number,
): { session: SessionView; respond: RespondPublic } | null => {
	let best: { session: SessionView; respond: RespondPublic } | null = null;
	for (const session of sessions) {
		if (session.type !== RESPOND_TYPE) continue;
		const respond = parseRespond(session.public);
		if (!respond || !isRespondLive(respond, now)) continue;
		if (!best || session.createdAt >= best.session.createdAt) best = { session, respond };
	}
	return best;
};

const EMPTY: RespondState = {
	session: null,
	respond: null,
	isHost: false,
	mine: null,
	answeredCount: 0,
	participants: [],
};

/**
 * The client half of `respond`. Pass it to `createSessionPlugin({ types })`. It
 * has no HUD card; the host draws its UI with {@link getRespondApi}. The host's
 * client removes a session once it is past its safety net.
 */
export function createRespondClientType(options: RespondClientOptions = {}): ClientSessionType {
	const now = options.now ?? Date.now;

	const attach = (ctx: SessionAttachContext) => {
		const { client, userId } = ctx;
		const listeners = new Set<() => void>();
		let state: RespondState = EMPTY;
		let endSentFor: unknown = null;
		let disposed = false;

		const update = () => {
			if (disposed) return;
			const t = now();
			let snapshot = client.getState();
			// Sent once per snapshot (on a server the removal comes back later).
			if (snapshot.sessions !== endSentFor) {
				const expired = snapshot.sessions.filter((s) => {
					if (s.type !== RESPOND_TYPE || s.hostUserId !== userId) return false;
					const r = parseRespond(s.public);
					return r !== null && !isRespondLive(r, t);
				});
				if (expired.length > 0) {
					endSentFor = snapshot.sessions;
					for (const s of expired) client.end(s.id);
					if (disposed) return;
					snapshot = client.getState();
				}
			}
			const live = pickLive(snapshot.sessions, t);
			if (!live) {
				state = EMPTY;
			} else {
				const priv = snapshot.privates[live.session.id] as RespondPrivate | undefined;
				state = {
					session: live.session,
					respond: live.respond,
					isHost: live.session.hostUserId === userId,
					mine:
						priv?.mine ??
						(live.respond.revealed
							? (live.respond.answers.find((a) => a.userId === userId) ?? null)
							: null),
					answeredCount: live.respond.answeredUserIds.length,
					participants: [...live.session.participants].sort((a, b) => a.joinedAt - b.joinedAt),
				};
			}
			for (const l of listeners) l();
		};

		const offClient = client.subscribe(update);
		update();

		const liveId = () => pickLive(client.getState().sessions, now())?.session.id ?? null;

		const api: RespondApi = {
			getState: () => state,
			subscribe(listener) {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
			start(input) {
				const config = createRespondConfig(input, now());
				if (!config) return false;
				const mine = client
					.getState()
					.sessions.filter((s) => s.type === RESPOND_TYPE && s.hostUserId === userId);
				for (const s of mine) client.end(s.id);
				client.create(config);
				return true;
			},
			submit(text, tag, parts) {
				const id = liveId();
				if (!id) return;
				// Drop empty pieces and empty tags here, so one blank part does not
				// get the whole answer refused.
				const cleanParts = (parts ?? []).flatMap((p) => {
					const partText = p.text.trim();
					if (partText === "") return [];
					const partTag = p.tag?.trim();
					return [{ text: partText, ...(partTag ? { tag: partTag } : {}) }];
				});
				client.act(id, {
					kind: "submit",
					text,
					...(tag ? { tag } : {}),
					...(cleanParts.length > 0 ? { parts: cleanParts } : {}),
				});
			},
			retract() {
				const id = liveId();
				if (id) client.act(id, { kind: "retract" });
			},
			reveal() {
				const live = pickLive(client.getState().sessions, now());
				if (!live || live.session.hostUserId !== userId || live.respond.revealed) return;
				client.close(live.session.id);
			},
			end() {
				const live = pickLive(client.getState().sessions, now());
				if (!live || live.session.hostUserId !== userId) return;
				client.end(live.session.id);
			},
		};
		const offService = respondService.provide(ctx.services, api);

		return () => {
			disposed = true;
			offClient();
			offService();
			listeners.clear();
		};
	};

	return { type: RESPOND_TYPE, label: "答える", attach };
}
