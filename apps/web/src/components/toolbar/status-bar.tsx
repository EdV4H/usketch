import { useApp } from "@edv4h/usketch-canvas-engine";
import { useState } from "react";
import { dropdownStyle, menuItemStyle } from "../../lib/styles.js";

type WsProvider = {
	awareness: {
		setLocalStateField: (field: string, value: unknown) => void;
		getLocalState: () => Record<string, unknown> | null;
		getStates: () => Map<number, Record<string, unknown>>;
		doc: { clientID: number };
	};
};

export function StatusBar({ wsProvider }: { wsProvider: WsProvider }) {
	const app = useApp();
	const [showStatus, setShowStatus] = useState(false);
	const [currentStatus, setCurrentStatus] = useState("active");
	const [followingName, setFollowingName] = useState<string | null>(null);
	const [showFollowMenu, setShowFollowMenu] = useState(false);

	return (
		<div
			style={{
				position: "fixed",
				bottom: 12,
				left: 12,
				zIndex: 100,
				display: "flex",
				gap: 6,
				alignItems: "center",
			}}
		>
			<button
				type="button"
				onClick={() => setShowStatus((v) => !v)}
				style={{
					height: 36,
					padding: "0 12px",
					background: "white",
					border: "none",
					borderRadius: 8,
					boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
					fontSize: 12,
					cursor: "pointer",
					color: "#333",
				}}
			>
				{currentStatus === "active" ? "🟢" : currentStatus === "away" ? "💤" : "🔴"} {currentStatus}
			</button>
			{showStatus && (
				<div
					style={{
						...dropdownStyle,
						bottom: 42,
						left: 0,
						minWidth: 120,
					}}
				>
					{(["active", "away", "busy"] as const).map((s) => (
						<button
							key={s}
							type="button"
							onClick={() => {
								setCurrentStatus(s);
								setShowStatus(false);
								const existing =
									(wsProvider.awareness.getLocalState()?.user as Record<string, unknown>) ?? {};
								wsProvider.awareness.setLocalStateField("user", {
									...existing,
									status: s,
								});
							}}
							style={{
								...menuItemStyle,
								fontWeight: currentStatus === s ? 600 : 400,
							}}
						>
							{s === "active" ? "🟢" : s === "away" ? "💤" : "🔴"} {s}
						</button>
					))}
				</div>
			)}
			<div style={{ position: "relative" }}>
				<button
					type="button"
					onClick={() => {
						if (followingName) {
							app.events.emit("follow:stop", {});
							setFollowingName(null);
						} else {
							setShowFollowMenu((v) => !v);
						}
					}}
					style={{
						height: 36,
						padding: "0 14px",
						background: followingName ? "#e3f2fd" : "white",
						color: followingName ? "#1976d2" : "#333",
						border: "none",
						borderRadius: 8,
						boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
						fontSize: 12,
						fontWeight: 600,
						cursor: "pointer",
					}}
					title="Follow a member (f)"
				>
					{followingName ? `Unfollow ${followingName}` : "Follow"}
				</button>
				{showFollowMenu &&
					(() => {
						const states = wsProvider.awareness.getStates();
						const members: { clientId: number; name: string; presenting: boolean }[] = [];
						for (const [clientId, state] of states) {
							if (clientId === wsProvider.awareness.doc.clientID) continue;
							const user = state.user as { name?: string } | undefined;
							members.push({
								clientId,
								name: user?.name ?? "Unknown",
								presenting: state.presenting === true,
							});
						}
						return (
							<div
								style={{
									...dropdownStyle,
									bottom: 42,
									left: 0,
									minWidth: 160,
								}}
							>
								{members.length === 0 ? (
									<div style={{ ...menuItemStyle, color: "#999" }}>No other members online</div>
								) : (
									members.map((m) => (
										<button
											key={m.clientId}
											type="button"
											onClick={() => {
												setFollowingName(m.name);
												setShowFollowMenu(false);
												app.events.emit("follow:start", {
													clientId: m.clientId,
													name: m.name,
												});
											}}
											style={{
												...menuItemStyle,
												fontWeight: m.presenting ? 600 : 400,
											}}
										>
											{m.presenting ? "📺 " : ""}
											{m.name}
										</button>
									))
								)}
							</div>
						);
					})()}
			</div>
		</div>
	);
}
