import { useApp } from "@edv4h/usketch-canvas-engine";
import { useNavigate } from "react-router";
import { useAuth } from "../../lib/use-auth.js";

export function CommunityHeader({ regionName }: { regionName: string }) {
	const navigate = useNavigate();
	const { user: sessionUser, logout } = useAuth();
	const app = useApp();

	return (
		<>
			<div
				style={{
					position: "fixed",
					top: 12,
					left: 12,
					zIndex: 100,
					display: "flex",
					gap: 8,
					alignItems: "center",
				}}
			>
				<button
					type="button"
					onClick={() => navigate("/community")}
					style={{
						background: "white",
						border: "none",
						borderRadius: 8,
						padding: "6px 12px",
						boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
						fontSize: 14,
						cursor: "pointer",
						color: "#0066ff",
						fontFamily: "system-ui, sans-serif",
					}}
				>
					World Map
				</button>
				<div
					style={{
						background: "white",
						borderRadius: 8,
						padding: "6px 14px",
						boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
						fontSize: 14,
						fontWeight: 600,
						fontFamily: "system-ui, sans-serif",
					}}
				>
					{regionName || "uSketch"}
				</div>
				{sessionUser ? (
					<button
						type="button"
						onClick={() => {
							logout();
							navigate("/login");
						}}
						style={{
							background: "white",
							border: "none",
							borderRadius: 8,
							padding: "6px 12px",
							boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
							fontSize: 12,
							cursor: "pointer",
							color: "#666",
						}}
					>
						{sessionUser.name} — Sign Out
					</button>
				) : (
					<a
						href="/login"
						style={{
							background: "white",
							borderRadius: 8,
							padding: "6px 12px",
							boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
							fontSize: 12,
							textDecoration: "none",
							color: "#0066ff",
						}}
					>
						Sign In
					</a>
				)}
			</div>
			{/* 右上: サイドパネル開閉ボタン */}
			{sessionUser && (
				<div
					style={{
						position: "fixed",
						top: 12,
						right: 12,
						zIndex: 100,
						display: "flex",
						gap: 6,
					}}
				>
					<button
						type="button"
						onClick={() => app.events.emit("side-panel:toggle", { tabId: "board-info" })}
						style={{
							background: "white",
							border: "none",
							borderRadius: 8,
							padding: "6px 10px",
							boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
							fontSize: 14,
							cursor: "pointer",
							color: "#475569",
						}}
						title="Board Info"
					>
						📋
					</button>
					<button
						type="button"
						onClick={() => app.events.emit("side-panel:toggle", { tabId: "comments" })}
						style={{
							background: "white",
							border: "none",
							borderRadius: 8,
							padding: "6px 10px",
							boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
							fontSize: 14,
							cursor: "pointer",
							color: "#475569",
						}}
						title="Comments"
					>
						💬
					</button>
					<button
						type="button"
						onClick={() => app.events.emit("side-panel:toggle", { tabId: "community-chat" })}
						style={{
							background: "white",
							border: "none",
							borderRadius: 8,
							padding: "6px 10px",
							boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
							fontSize: 14,
							cursor: "pointer",
							color: "#475569",
						}}
						title="Chat"
						aria-label="Chat"
					>
						🗨️
					</button>
				</div>
			)}
		</>
	);
}
