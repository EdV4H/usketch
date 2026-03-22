import type { EventBus } from "@edv4h/usketch-shared";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { TabStore } from "./tab-store.js";
import type { SidePanelOpenEvent } from "./types.js";

interface SidePanelUIProps {
	events: EventBus;
	tabStore: TabStore;
}

export function SidePanelUI({ events, tabStore }: SidePanelUIProps) {
	const tabs = useSyncExternalStore(tabStore.subscribe, tabStore.getTabs, tabStore.getTabs);
	const [activeTabId, setActiveTabId] = useState<string | null>(null);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const unsubs: (() => void)[] = [];

		unsubs.push(
			events.on<SidePanelOpenEvent>("side-panel:open", (ev) => {
				setOpen(true);
				if (ev.tabId) setActiveTabId(ev.tabId);
			}),
		);

		unsubs.push(
			events.on("side-panel:close", () => {
				setOpen(false);
			}),
		);

		unsubs.push(
			events.on<SidePanelOpenEvent>("side-panel:toggle", (ev) => {
				setOpen((prev) => {
					const next = !prev;
					if (next && ev.tabId) setActiveTabId(ev.tabId);
					return next;
				});
			}),
		);

		return () => {
			for (const u of unsubs) u();
		};
	}, [events]);

	// activeTabIdがnullかつタブがある場合、最初のタブを選択
	const resolvedTabId = activeTabId ?? tabs[0]?.id ?? null;
	const activeTab = tabs.find((t) => t.id === resolvedTabId);

	const handleClose = useCallback(() => {
		setOpen(false);
		events.emit("side-panel:close", {});
	}, [events]);

	if (!open || tabs.length === 0) return null;

	return (
		<div
			role="dialog"
			onPointerDown={(e) => e.stopPropagation()}
			onPointerUp={(e) => e.stopPropagation()}
			onClick={(e) => e.stopPropagation()}
			onKeyDown={(e) => e.stopPropagation()}
			style={{
				position: "fixed",
				top: 60,
				right: 12,
				width: 360,
				maxHeight: "calc(100vh - 80px)",
				background: "#fff",
				borderRadius: 12,
				boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
				zIndex: 160,
				fontFamily: "system-ui, -apple-system, sans-serif",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}
		>
			{/* タブバー */}
			<div
				style={{
					display: "flex",
					borderBottom: "1px solid #eee",
					alignItems: "center",
				}}
			>
				<div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
					{tabs.map((tab) => (
						<button
							key={tab.id}
							type="button"
							onClick={() => setActiveTabId(tab.id)}
							style={{
								flex: 1,
								padding: "10px 8px",
								border: "none",
								background: "none",
								cursor: "pointer",
								fontSize: 13,
								fontWeight: resolvedTabId === tab.id ? 600 : 400,
								color: resolvedTabId === tab.id ? "#1e1e1e" : "#999",
								borderBottom:
									resolvedTabId === tab.id ? "2px solid #1e1e1e" : "2px solid transparent",
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							}}
						>
							{tab.icon} {tab.label}
						</button>
					))}
				</div>
				<button
					type="button"
					onClick={handleClose}
					style={{
						border: "none",
						background: "none",
						fontSize: 16,
						cursor: "pointer",
						color: "#999",
						padding: "8px 12px",
						flexShrink: 0,
					}}
				>
					✕
				</button>
			</div>

			{/* タブコンテンツ */}
			<div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
				{activeTab ? activeTab.render() : null}
			</div>
		</div>
	);
}
