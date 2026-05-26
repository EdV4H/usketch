import type { PluginContext, TransientObject, UsketchPlugin } from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";

interface VoteOption {
	label: string;
	votes: number;
}

interface VotePoll {
	id: string;
	question: string;
	options: VoteOption[];
	position: { x: number; y: number };
	createdBy: string;
}

function VoteCard({ obj }: { obj: TransientObject }) {
	const question = (obj.data.question as string) || "";
	const options = (obj.data.options as VoteOption[]) || [];
	const totalVotes = options.reduce((sum, o) => sum + o.votes, 0);

	return (
		<div
			style={{
				position: "absolute",
				left: -100,
				top: -20,
				width: 200,
				background: "#fff",
				borderRadius: 12,
				padding: 12,
				boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
				border: "1px solid #e0e0e0",
				fontFamily: "system-ui, sans-serif",
				pointerEvents: "none",
			}}
		>
			<div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#333" }}>
				{question}
			</div>
			{options.map((opt) => {
				const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
				return (
					<div key={opt.label} style={{ marginBottom: 4 }}>
						<div style={{ fontSize: 12, color: "#555", marginBottom: 2 }}>
							{opt.label} ({opt.votes})
						</div>
						<div
							style={{
								height: 6,
								borderRadius: 3,
								background: "#eee",
								overflow: "hidden",
							}}
						>
							<div
								style={{
									height: "100%",
									width: `${pct}%`,
									background: "#0066ff",
									borderRadius: 3,
									transition: "width 0.3s",
								}}
							/>
						</div>
					</div>
				);
			})}
			{totalVotes > 0 && (
				<div style={{ fontSize: 10, color: "#999", marginTop: 6, textAlign: "right" }}>
					{totalVotes} votes
				</div>
			)}
		</div>
	);
}

function VotingIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<title>Vote</title>
			<rect
				x="3"
				y="4"
				width="4"
				height="12"
				rx="1"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
			/>
			<rect
				x="8"
				y="8"
				width="4"
				height="8"
				rx="1"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
			/>
			<rect
				x="13"
				y="2"
				width="4"
				height="14"
				rx="1"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
			/>
		</svg>
	);
}

function createPlugin(wsProvider?: WsProviderHandle): UsketchPlugin {
	return {
		id: "usketch-plugin-voting",
		name: "空間投票",

		setup(ctx: PluginContext) {
			ctx.transient.registerType("vote-card", {
				render: (obj) => <VoteCard obj={obj} />,
			});

			const polls = new Map<string, VotePoll>();
			let pollCounter = 0;

			function renderPoll(poll: VotePoll) {
				ctx.transient.dismiss(`vote-${poll.id}`);
				ctx.transient.emit({
					id: `vote-${poll.id}`,
					type: "vote-card",
					sourceUserId: poll.createdBy,
					position: poll.position,
					data: {
						question: poll.question,
						options: poll.options,
						interactive: true,
					},
					createdAt: Date.now(),
				});
			}

			let unsubBroadcast: (() => void) | undefined;
			if (wsProvider) {
				unsubBroadcast = wsProvider.onBroadcast((msg) => {
					if (msg.kind === "vote-create") {
						const poll: VotePoll = {
							id: msg.id as string,
							question: msg.question as string,
							options: msg.options as VoteOption[],
							position: msg.position as { x: number; y: number },
							createdBy: msg.createdBy as string,
						};
						polls.set(poll.id, poll);
						renderPoll(poll);
					} else if (msg.kind === "vote-cast") {
						const poll = polls.get(msg.pollId as string);
						if (poll) {
							const optIdx = msg.optionIndex as number;
							if (poll.options[optIdx]) {
								poll.options[optIdx].votes++;
								renderPoll(poll);
							}
						}
					}
				});
			}

			function createPoll(
				question: string,
				optionLabels: string[],
				position: { x: number; y: number },
			) {
				const id = `poll-${Date.now()}-${pollCounter++}`;
				const poll: VotePoll = {
					id,
					question,
					options: optionLabels.map((label) => ({ label, votes: 0 })),
					position,
					createdBy: "local",
				};
				polls.set(id, poll);
				renderPoll(poll);

				wsProvider?.broadcast({
					kind: "vote-create",
					id,
					question,
					options: poll.options,
					position,
					createdBy: "local",
				});

				return id;
			}

			function castVote(pollId: string, optionIndex: number) {
				const poll = polls.get(pollId);
				if (!poll || !poll.options[optionIndex]) return;

				poll.options[optionIndex].votes++;
				renderPoll(poll);

				wsProvider?.broadcast({
					kind: "vote-cast",
					pollId,
					optionIndex,
				});
			}

			// EventBus経由で投票作成/投票
			const unsubCreate = ctx.events.on<{
				question: string;
				options: string[];
				position: { x: number; y: number };
			}>("vote:create", ({ question, options, position }) => {
				createPoll(question, options, position);
			});

			const unsubCast = ctx.events.on<{ pollId: string; optionIndex: number }>(
				"vote:cast",
				({ pollId, optionIndex }) => {
					castVote(pollId, optionIndex);
				},
			);

			// ツールとして登録（クリックでデフォルト投票を作成）
			ctx.tools.register("voting", {
				icon: VotingIcon,
				cursor: "crosshair",
				shortcut: "n",
				order: 75,
				onPointerDown: (_toolCtx, event) => {
					createPoll("Vote", ["Yes", "No"], event.worldPoint);
					ctx.store.setActiveToolId("select");
				},
			});

			return () => {
				unsubBroadcast?.();
				unsubCreate();
				unsubCast();
				for (const poll of polls.values()) {
					ctx.transient.dismiss(`vote-${poll.id}`);
				}
				polls.clear();
			};
		},
	};
}

export function createVotingPlugin(wsProvider?: WsProviderHandle): UsketchPlugin {
	return createPlugin(wsProvider);
}
