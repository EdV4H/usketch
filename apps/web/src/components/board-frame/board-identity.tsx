import type { WsConnectionStatus } from "@edv4h/usketch-sync";
import { useNavigate } from "react-router";

interface BoardIdentityProps {
	boardName?: string;
	isCloudBoard: boolean;
	connectionStatus?: WsConnectionStatus;
}

/** 画面左上: ロゴ (ダッシュボードへ戻る) + ボード名 + 保存ステータス。 */
export function BoardIdentity({ boardName, isCloudBoard, connectionStatus }: BoardIdentityProps) {
	const navigate = useNavigate();
	const status = renderStatus(isCloudBoard, connectionStatus);

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
					{status && (
						<div
							style={{
								fontSize: 10.5,
								color: "var(--fg-tertiary)",
								display: "flex",
								alignItems: "center",
								gap: 5,
							}}
						>
							<div
								style={{
									width: 6,
									height: 6,
									borderRadius: 99,
									background: status.color,
								}}
							/>
							{status.text}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function renderStatus(
	isCloudBoard: boolean,
	connectionStatus?: WsConnectionStatus,
): { color: string; text: string } | null {
	if (!isCloudBoard) return { color: "var(--fg-tertiary)", text: "ローカル保存" };
	switch (connectionStatus) {
		case "connected":
			return { color: "var(--success)", text: "自動保存済み" };
		case "connecting":
			return { color: "var(--warning)", text: "接続中…" };
		case "failed":
		case "disconnected":
			return { color: "var(--danger)", text: "オフライン" };
		default:
			return null;
	}
}
