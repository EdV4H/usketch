import { useNavigate } from "react-router";

interface BoardIdentityProps {
	boardName?: string;
}

/**
 * 画面左上: ロゴ (ダッシュボードへ戻る) + ボード名。
 * 接続/保存ステータスは Control HUD(General パネル)に集約したためここでは表示しない。
 */
export function BoardIdentity({ boardName }: BoardIdentityProps) {
	const navigate = useNavigate();

	return (
		<div
			style={{
				position: "fixed",
				top: 12,
				left: 12,
				display: "flex",
				gap: 8,
				zIndex: 30,
				alignItems: "center",
			}}
		>
			<button
				type="button"
				onClick={() => navigate("/dashboard")}
				className="u-surface"
				title="ダッシュボードへ戻る"
				aria-label="ダッシュボードへ戻る"
				style={{
					padding: "6px 10px 6px 7px",
					display: "inline-flex",
					alignItems: "center",
					gap: 8,
					border: "none",
					color: "var(--fg-primary)",
					borderRadius: 10,
					cursor: "pointer",
					fontFamily: "inherit",
				}}
			>
				<div
					style={{
						width: 22,
						height: 22,
						borderRadius: 6,
						background: "var(--brand-gradient)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: "white",
						fontWeight: 700,
						fontSize: 12,
						letterSpacing: -0.5,
					}}
				>
					u
				</div>
			</button>
			{boardName && (
				<div
					className="u-surface"
					style={{
						padding: "6px 12px",
						borderRadius: 10,
						display: "flex",
						flexDirection: "column",
						lineHeight: 1.15,
					}}
				>
					<div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-primary)" }}>
						{boardName}
					</div>
				</div>
			)}
		</div>
	);
}
