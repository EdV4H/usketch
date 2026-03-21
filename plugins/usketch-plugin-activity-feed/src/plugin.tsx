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

function ActivityPanel({ entries, onClose }: { entries: ActivityEntry[]; onClose: () => void }) {
	return (
		<div
			style={{
				position: "fixed",
				top: 60,
				right: 12,
				width: 280,
				maxHeight: "calc(100vh - 120px)",
				background: "#fff",
				borderRadius: 12,
				boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
				zIndex: 150,
				overflow: "hidden",
				fontFamily: "system-ui, sans-serif",
				display: "flex",
				flexDirection: "column",
			}}
		>
			<div
				style={{
					padding: "12px 16px",
					borderBottom: "1px solid #eee",
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
				}}
			>
				<span style={{ fontSize: 14, fontWeight: 600 }}>Activity</span>
				<button
					type="button"
					onClick={onClose}
					style={{
						border: "none",
						background: "none",
						fontSize: 16,
						cursor: "pointer",
						color: "#999",
					}}
				>
					x
				</button>
			</div>
			<div style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}>
				{entries.length === 0 ? (
					<div style={{ padding: "16px", textAlign: "center", color: "#999", fontSize: 13 }}>
						No activity yet
					</div>
				) : (
					entries.map((entry) => (
						<div
							key={entry.id}
							style={{
								padding: "6px 16px",
								fontSize: 12,
								color: "#555",
								borderBottom: "1px solid #f5f5f5",
							}}
						>
							<div>
								<span style={{ fontWeight: 500 }}>{entry.action}</span>
								{entry.summary && <span style={{ color: "#999" }}> — {entry.summary}</span>}
							</div>
							<div style={{ fontSize: 10, color: "#bbb", marginTop: 2 }}>
								{formatTime(entry.createdAt)}
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
}

function ActivityButton({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			title="Activity Feed"
			style={{
				position: "fixed",
				bottom: 12,
				right: 12,
				width: 40,
				height: 40,
				borderRadius: "50%",
				border: "none",
				background: "#fff",
				boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
				cursor: "pointer",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				zIndex: 100,
				fontSize: 16,
			}}
		>
			<svg width="20" height="20" viewBox="0 0 20 20">
				<title>Activity</title>
				<polyline
					points="2,14 6,10 10,12 14,6 18,8"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<circle cx="18" cy="4" r="2" fill="currentColor" opacity="0.5" />
			</svg>
		</button>
	);
}

function ActivityFeedUI({ boardId, apiUrl }: { boardId: string; apiUrl: string }) {
	const [open, setOpen] = useState(false);
	const [entries, setEntries] = useState<ActivityEntry[]>([]);
	const fetchedRef = useRef(false);

	useEffect(() => {
		if (!open || fetchedRef.current) return;
		fetchedRef.current = true;

		fetch(`${apiUrl}/api/boards/${boardId}/activity`, { credentials: "include" })
			.then((res) => (res.ok ? res.json() : []))
			.then((data) => setEntries(data as ActivityEntry[]))
			.catch(() => {});
	}, [open, boardId, apiUrl]);

	return (
		<>
			<ActivityButton onClick={() => setOpen((v) => !v)} />
			{open && <ActivityPanel entries={entries} onClose={() => setOpen(false)} />}
		</>
	);
}

export interface ActivityFeedOptions {
	wsProvider: WsProviderHandle;
	boardId: string;
	apiUrl: string;
}

export function createActivityFeedPlugin(options: ActivityFeedOptions): UsketchPlugin {
	const { boardId, apiUrl } = options;

	let cleanup: (() => void) | undefined;

	return {
		id: "usketch-plugin-activity-feed",
		name: "アクティビティフィード",

		setup(ctx: PluginContext) {
			ctx.layers.register({
				id: "activity-feed",
				order: 200,
				fixed: true,
				render: () => <ActivityFeedUI boardId={boardId} apiUrl={apiUrl} />,
			});

			cleanup = () => {
				ctx.layers.unregister("activity-feed");
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}
