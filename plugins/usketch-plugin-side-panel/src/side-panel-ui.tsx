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

	// activeTabIdがnull、または存在しないタブを指している場合、最初のタブにフォールバック
	const validTabId = activeTabId && tabs.some((t) => t.id === activeTabId) ? activeTabId : null;
	const resolvedTabId = validTabId ?? tabs[0]?.id ?? null;
	const activeTab = tabs.find((t) => t.id === resolvedTabId);

	const handleClose = useCallback(() => {
		setOpen(false);
		events.emit("side-panel:close", {});
	}, [events]);

	if (!open || tabs.length === 0) return null;

	return (
		<aside
			aria-label="Side Panel"
			className="u-surface u-anim-in"
			onPointerDown={(e) => e.stopPropagation()}
			onPointerUp={(e) => e.stopPropagation()}
			onClick={(e) => e.stopPropagation()}
			onKeyDown={(e) => {
				// Cmd/Ctrl ショートカットはグローバルリスナー（Cmd+K等）に伝播させる
				if (e.metaKey || e.ctrlKey) return;
				e.stopPropagation();
			}}
			onWheel={(e) => e.stopPropagation()}
			style={{
				position: "fixed",
				top: 70,
				right: 12,
				width: 340,
				maxHeight: "calc(100vh - 160px)",
				borderRadius: 14,
				zIndex: 160,
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				color: "var(--fg-primary)",
				fontFamily: "var(--font-sans, system-ui, sans-serif)",
			}}
		>
			<div
				style={{
					display: "flex",
					padding: 6,
					gap: 2,
					borderBottom: "1px solid var(--border-subtle)",
					alignItems: "center",
				}}
			>
				<div style={{ display: "flex", flex: 1, minWidth: 0 }}>
					{tabs.map((tab) => {
						const active = resolvedTabId === tab.id;
						return (
							<button
								key={tab.id}
								type="button"
								onClick={() => setActiveTabId(tab.id)}
								title={tab.label}
								style={{
									flex: 1,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									gap: 5,
									padding: "7px 6px",
									background: active ? "var(--bg-active)" : "transparent",
									color: active ? "var(--brand-violet)" : "var(--fg-secondary)",
									border: "none",
									borderRadius: 7,
									cursor: "pointer",
									fontSize: 11.5,
									fontWeight: 500,
									fontFamily: "inherit",
									whiteSpace: "nowrap",
									minWidth: 0,
									transition: "background var(--dur-fast), color var(--dur-fast)",
								}}
							>
								<TabIcon tab={tab} />
								<span
									style={{
										overflow: "hidden",
										textOverflow: "ellipsis",
									}}
								>
									{tab.label}
								</span>
							</button>
						);
					})}
				</div>
				<button
					type="button"
					onClick={handleClose}
					aria-label="サイドパネルを閉じる"
					style={{
						padding: 7,
						background: "transparent",
						border: "none",
						color: "var(--fg-tertiary)",
						cursor: "pointer",
						borderRadius: 6,
						fontSize: 14,
						lineHeight: 1,
						flexShrink: 0,
					}}
				>
					×
				</button>
			</div>

			<div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
				{activeTab ? activeTab.render() : null}
			</div>
		</aside>
	);
}

function TabIcon({ tab }: { tab: { icon: string; iconComponent?: () => React.ReactNode } }) {
	if (tab.iconComponent) return <>{tab.iconComponent()}</>;
	return <span style={{ fontSize: 13, lineHeight: 1 }}>{tab.icon}</span>;
}
