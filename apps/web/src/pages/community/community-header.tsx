import { useApp } from "@edv4h/usketch-canvas-engine";
import { useNavigate } from "react-router";
import { I, IconBtn, ThemeToggle } from "../../components/ui/index.js";
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
					className="u-surface"
					style={{
						border: "none",
						padding: "6px 12px",
						fontSize: 12,
						cursor: "pointer",
						color: "var(--fg-secondary)",
						fontFamily: "var(--font-sans)",
						display: "inline-flex",
						alignItems: "center",
						gap: 6,
						borderRadius: 10,
					}}
				>
					<I.map size={12} />
					ワールドマップ
				</button>
				<div
					className="u-surface"
					style={{
						padding: "6px 14px",
						fontSize: 13,
						fontWeight: 600,
						fontFamily: "var(--font-sans)",
						color: "var(--fg-primary)",
						borderRadius: 10,
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
						className="u-surface"
						style={{
							border: "none",
							padding: "6px 12px",
							fontSize: 11.5,
							cursor: "pointer",
							color: "var(--fg-tertiary)",
							fontFamily: "var(--font-sans)",
							borderRadius: 10,
						}}
					>
						{sessionUser.name} — サインアウト
					</button>
				) : (
					<a
						href="/login"
						className="u-surface"
						style={{
							padding: "6px 12px",
							fontSize: 11.5,
							textDecoration: "none",
							color: "var(--brand-violet)",
							fontFamily: "var(--font-sans)",
							borderRadius: 10,
						}}
					>
						サインイン
					</a>
				)}
			</div>
			{/* 右上: テーマ切替 + サイドパネル開閉 */}
			<div
				style={{
					position: "fixed",
					top: 12,
					right: 12,
					zIndex: 100,
					display: "flex",
					gap: 8,
					alignItems: "center",
				}}
			>
				<ThemeToggle />
				{sessionUser && (
					<div
						className="u-surface"
						style={{
							padding: 3,
							display: "flex",
							gap: 1,
							borderRadius: 10,
						}}
					>
						<IconBtn
							icon={I.folder}
							label="ボード情報"
							tooltipPlacement="bottom"
							onClick={() => app.events.emit("side-panel:toggle", { tabId: "board-info" })}
						/>
						<IconBtn
							icon={I.comment}
							label="コメント"
							tooltipPlacement="bottom"
							onClick={() => app.events.emit("side-panel:toggle", { tabId: "comments" })}
						/>
						<IconBtn
							icon={I.chat}
							label="チャット"
							tooltipPlacement="bottom"
							onClick={() => app.events.emit("side-panel:toggle", { tabId: "community-chat" })}
						/>
					</div>
				)}
			</div>
		</>
	);
}
