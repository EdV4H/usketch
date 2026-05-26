import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import { useEffect, useRef, useState } from "react";

interface ActivityEntry {
	id: string;
	userId: string;
	action: string;
	targetId: string | null;
	summary: string | null;
	createdAt: string;
}

function formatTime(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ActivityTab({ boardId, apiUrl }: { boardId: string; apiUrl: string }) {
	const [entries, setEntries] = useState<ActivityEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const fetchedRef = useRef(false);

	useEffect(() => {
		if (fetchedRef.current) return;
		fetchedRef.current = true;
		setLoading(true);
		fetch(`${apiUrl}/api/boards/${boardId}/activity`, { credentials: "include" })
			.then((res) => (res.ok ? res.json() : []))
			.then((data) => setEntries(data as ActivityEntry[]))
			.catch(() => {})
			.finally(() => setLoading(false));
	}, [boardId, apiUrl]);

	if (loading) {
		return (
			<div
				style={{
					padding: 20,
					textAlign: "center",
					color: "var(--fg-tertiary)",
					fontSize: 12,
				}}
			>
				読み込み中…
			</div>
		);
	}

	if (entries.length === 0) {
		return (
			<div
				style={{
					padding: 20,
					textAlign: "center",
					color: "var(--fg-tertiary)",
					fontSize: 12,
				}}
			>
				まだアクティビティがありません
			</div>
		);
	}

	return (
		<div
			style={{
				padding: "8px 0",
				display: "flex",
				flexDirection: "column",
			}}
		>
			{entries.map((entry) => (
				<div
					key={entry.id}
					style={{
						padding: "8px 16px",
						fontSize: 12,
						color: "var(--fg-primary)",
						borderBottom: "1px solid var(--border-subtle)",
						display: "flex",
						flexDirection: "column",
						gap: 2,
					}}
				>
					<div style={{ lineHeight: 1.4 }}>
						<span style={{ fontWeight: 500 }}>{entry.action}</span>
						{entry.summary && (
							<span style={{ color: "var(--fg-tertiary)" }}> — {entry.summary}</span>
						)}
					</div>
					<div
						style={{
							fontSize: 10.5,
							color: "var(--fg-tertiary)",
							fontFamily: "var(--font-mono)",
						}}
					>
						{formatTime(entry.createdAt)}
					</div>
				</div>
			))}
		</div>
	);
}

function ActivityIcon() {
	return (
		<svg
			width={13}
			height={13}
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M2.5 8a5.5 5.5 0 1 0 1.5-3.8" />
			<path d="M2.5 3v3h3M8 5v3l2 1.5" />
		</svg>
	);
}

export interface ActivityFeedOptions {
	wsProvider: WsProviderHandle;
	boardId: string;
	apiUrl: string;
}

export function createActivityFeedPlugin(options: ActivityFeedOptions): UsketchPlugin {
	const { boardId, apiUrl } = options;

	return {
		id: "usketch-plugin-activity-feed",
		name: "アクティビティフィード",

		setup(ctx: PluginContext) {
			ctx.events.emit("side-panel:register-tab", {
				tab: {
					id: "activity",
					label: "履歴",
					icon: "🕒",
					iconComponent: () => <ActivityIcon />,
					order: 40,
					render: () => <ActivityTab boardId={boardId} apiUrl={apiUrl} />,
				},
			});

			return () => {
				ctx.events.emit("side-panel:unregister-tab", { tabId: "activity" });
			};
		},
	};
}
