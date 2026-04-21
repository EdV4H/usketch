import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { I, ThemeToggle } from "../components/ui/index.js";
import { api, type Board } from "../lib/api.js";
import { getErrorMessage } from "../lib/errors.js";
import { type LocalBoard, localBoards } from "../lib/local-boards.js";
import { useAuth } from "../lib/use-auth.js";

type Filter = "all" | "cloud" | "local";

export function DashboardPage() {
	const navigate = useNavigate();
	const { user: sessionUser, logout } = useAuth();
	const [boards, setBoards] = useState<Board[]>([]);
	const [locals, setLocals] = useState<LocalBoard[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [filter, setFilter] = useState<Filter>("all");

	const loadBoards = useCallback(async () => {
		setLocals(localBoards.list());
		setError("");
		if (sessionUser) {
			setLoading(true);
			try {
				const result = await api.boards.list();
				setBoards(result);
			} catch (e) {
				const msg = getErrorMessage(e, "Failed to load boards");
				if (msg.includes("401")) {
					setBoards([]);
				} else {
					setError(msg);
				}
			} finally {
				setLoading(false);
			}
		} else {
			setLoading(false);
		}
	}, [sessionUser]);

	useEffect(() => {
		loadBoards();
	}, [loadBoards]);

	const handleCreate = async () => {
		try {
			const board = await api.boards.create();
			navigate(`/boards/${board.id}`);
		} catch (e) {
			setError(getErrorMessage(e, "Failed to create board"));
		}
	};

	const handleCreateLocal = () => {
		const board = localBoards.create();
		navigate(`/local/${board.id}`);
	};

	const handleDelete = async (id: string) => {
		try {
			await api.boards.delete(id);
			loadBoards();
		} catch (e) {
			setError(getErrorMessage(e, "Failed to delete board"));
		}
	};

	const handleDeleteLocal = (id: string) => {
		localBoards.delete(id);
		setLocals(localBoards.list());
	};

	const showLocals = filter === "all" || filter === "local";
	const showCloud = filter === "all" || filter === "cloud";

	return (
		<div
			style={{
				minHeight: "100vh",
				overflow: "auto",
				background: "var(--bg-canvas)",
				color: "var(--fg-primary)",
				fontFamily: "var(--font-sans)",
			}}
		>
			<header
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					padding: "16px 28px",
					borderBottom: "1px solid var(--border-subtle)",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
					<div
						style={{
							width: 28,
							height: 28,
							borderRadius: 8,
							background: "var(--brand-gradient)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: "white",
							fontWeight: 700,
							letterSpacing: -0.5,
						}}
					>
						u
					</div>
					<h1 style={{ fontSize: 15, margin: 0, fontWeight: 600 }}>uSketch</h1>
				</div>
				<div style={{ display: "flex", gap: 10, alignItems: "center" }}>
					<ThemeToggle />
					<button type="button" onClick={() => navigate("/community")} style={secondaryBtn}>
						<I.community size={12} /> コミュニティ
					</button>
					{sessionUser ? (
						<>
							<span style={{ fontSize: 12, color: "var(--fg-secondary)" }}>{sessionUser.name}</span>
							<button
								type="button"
								onClick={() => {
									logout();
									navigate("/login");
								}}
								style={secondaryBtn}
							>
								サインアウト
							</button>
						</>
					) : (
						<button type="button" onClick={() => navigate("/login")} style={secondaryBtn}>
							サインイン
						</button>
					)}
				</div>
			</header>

			<div
				style={{
					maxWidth: 960,
					margin: "0 auto",
					padding: "28px 28px 60px",
					display: "flex",
					flexDirection: "column",
					gap: 20,
				}}
			>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						gap: 12,
						flexWrap: "wrap",
					}}
				>
					<div>
						<h2 style={{ fontSize: 20, margin: 0, fontWeight: 600 }}>ボード一覧</h2>
						<p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--fg-tertiary)" }}>
							作業中のボードを開く、または新しく作成します
						</p>
					</div>
					<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
						<button type="button" onClick={handleCreateLocal} style={ctaOutlineBtn}>
							<I.plus size={12} /> 新規ローカルボード
						</button>
						{sessionUser && (
							<button type="button" onClick={handleCreate} style={ctaPrimaryBtn}>
								<I.plus size={12} /> 新規クラウドボード
							</button>
						)}
					</div>
				</div>

				{/* フィルターチップ */}
				<div
					style={{
						display: "flex",
						gap: 6,
						padding: 4,
						background: "var(--bg-input)",
						border: "1px solid var(--border-subtle)",
						borderRadius: 8,
						alignSelf: "flex-start",
					}}
				>
					{(
						[
							{ v: "all", label: "すべて" },
							{ v: "cloud", label: "クラウド" },
							{ v: "local", label: "ローカル" },
						] as { v: Filter; label: string }[]
					).map((chip) => {
						const active = filter === chip.v;
						return (
							<button
								key={chip.v}
								type="button"
								aria-pressed={active}
								onClick={() => setFilter(chip.v)}
								style={{
									padding: "5px 12px",
									background: active ? "var(--bg-surface-raised)" : "transparent",
									color: active ? "var(--fg-primary)" : "var(--fg-tertiary)",
									border: "none",
									borderRadius: 5,
									fontSize: 11.5,
									fontWeight: 500,
									cursor: "pointer",
									fontFamily: "inherit",
								}}
							>
								{chip.label}
							</button>
						);
					})}
				</div>

				{error && (
					<div
						style={{
							padding: 12,
							borderRadius: 8,
							background: "rgba(239, 68, 68, 0.08)",
							border: "1px solid var(--danger)",
							color: "var(--danger)",
							fontSize: 12.5,
						}}
					>
						{error}
					</div>
				)}

				{showLocals && (
					<Section title="ローカルボード" hint="ブラウザにのみ保存されます">
						{locals.length === 0 ? (
							<Empty>
								ローカルボードはまだありません。「新規ローカルボード」から作成できます。
							</Empty>
						) : (
							<div style={gridStyle}>
								{locals.map((board) => (
									<BoardCard
										key={board.id}
										title={board.title}
										updatedAt={board.updatedAt}
										badge={{ label: "ローカル", icon: <I.folder size={10} /> }}
										onOpen={() => navigate(`/local/${board.id}`)}
										onDelete={() => handleDeleteLocal(board.id)}
									/>
								))}
							</div>
						)}
					</Section>
				)}

				{showCloud && (
					<Section
						title="クラウドボード"
						hint={sessionUser ? "共有・リアルタイム編集対応" : "サインインしてアクセス"}
					>
						{!sessionUser ? (
							<Empty>
								クラウドボードを使うには{" "}
								<a href="/login" style={linkStyle}>
									サインイン
								</a>{" "}
								してください。
							</Empty>
						) : loading ? (
							<Empty>読み込み中…</Empty>
						) : boards.length === 0 ? (
							<Empty>
								クラウドボードはまだありません。「新規クラウドボード」から作成してください。
							</Empty>
						) : (
							<div style={gridStyle}>
								{boards.map((board) => (
									<BoardCard
										key={board.id}
										title={board.title}
										updatedAt={board.updatedAt}
										badge={{ label: "クラウド", icon: <I.globe size={10} /> }}
										onOpen={() => navigate(`/boards/${board.id}`)}
										onDelete={board.role === "owner" ? () => handleDelete(board.id) : undefined}
									/>
								))}
							</div>
						)}
					</Section>
				)}
			</div>
		</div>
	);
}

function Section({
	title,
	hint,
	children,
}: {
	title: string;
	hint?: string;
	children: React.ReactNode;
}) {
	return (
		<section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
			<div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
				<h3 style={{ fontSize: 13, margin: 0, fontWeight: 600, color: "var(--fg-primary)" }}>
					{title}
				</h3>
				{hint && <span style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>{hint}</span>}
			</div>
			{children}
		</section>
	);
}

function Empty({ children }: { children: React.ReactNode }) {
	return (
		<div
			style={{
				padding: 20,
				borderRadius: 10,
				background: "var(--bg-input)",
				border: "1px dashed var(--border-default)",
				fontSize: 12.5,
				color: "var(--fg-tertiary)",
			}}
		>
			{children}
		</div>
	);
}

interface BoardCardProps {
	title: string;
	updatedAt: number | string;
	badge: { label: string; icon: React.ReactNode };
	onOpen: () => void;
	onDelete?: () => void;
}

function BoardCard({ title, updatedAt, badge, onOpen, onDelete }: BoardCardProps) {
	return (
		<div
			className="u-surface"
			style={{
				padding: 14,
				display: "flex",
				flexDirection: "column",
				gap: 8,
				cursor: "pointer",
				minHeight: 120,
				justifyContent: "space-between",
			}}
		>
			<button
				type="button"
				onClick={onOpen}
				style={{
					background: "transparent",
					border: "none",
					textAlign: "left",
					padding: 0,
					cursor: "pointer",
					color: "inherit",
					fontFamily: "inherit",
				}}
			>
				<div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg-primary)" }}>{title}</div>
				<div
					style={{
						fontSize: 10.5,
						color: "var(--fg-tertiary)",
						marginTop: 4,
						fontFamily: "var(--font-mono)",
					}}
				>
					{new Date(updatedAt).toLocaleDateString()}
				</div>
			</button>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
				<span
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: 4,
						fontSize: 10.5,
						color: "var(--fg-secondary)",
						background: "var(--bg-input)",
						padding: "2px 6px",
						borderRadius: 4,
					}}
				>
					{badge.icon}
					{badge.label}
				</span>
				{onDelete && (
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onDelete();
						}}
						title="削除"
						aria-label="削除"
						style={{
							padding: "3px 6px",
							fontSize: 10.5,
							background: "transparent",
							color: "var(--danger)",
							border: "1px solid var(--border-subtle)",
							borderRadius: 4,
							cursor: "pointer",
							fontFamily: "inherit",
						}}
					>
						削除
					</button>
				)}
			</div>
		</div>
	);
}

const gridStyle: React.CSSProperties = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
	gap: 12,
};

const secondaryBtn: React.CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	gap: 6,
	padding: "6px 12px",
	background: "transparent",
	border: "1px solid var(--border-default)",
	borderRadius: 8,
	color: "var(--fg-secondary)",
	fontSize: 12,
	cursor: "pointer",
	fontFamily: "inherit",
	textDecoration: "none",
};

const ctaOutlineBtn: React.CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	gap: 6,
	padding: "7px 14px",
	background: "transparent",
	border: "1px solid var(--brand-violet)",
	borderRadius: 8,
	color: "var(--brand-violet)",
	fontSize: 12.5,
	fontWeight: 500,
	cursor: "pointer",
	fontFamily: "inherit",
};

const ctaPrimaryBtn: React.CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	gap: 6,
	padding: "7px 14px",
	background: "var(--brand-gradient)",
	border: "none",
	borderRadius: 8,
	color: "white",
	fontSize: 12.5,
	fontWeight: 600,
	cursor: "pointer",
	fontFamily: "inherit",
	boxShadow: "0 4px 14px rgba(139, 92, 246, 0.25)",
};

const linkStyle: React.CSSProperties = {
	color: "var(--brand-violet)",
	textDecoration: "underline",
};
