import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { api, type Board, type DiscoverBoard } from "../lib/api.js";
import { type LocalBoard, localBoards } from "../lib/local-boards.js";
import { useAuth } from "../lib/use-auth.js";

function BoardCard({
	title,
	href,
	ownerName,
	ownerImage,
	updatedAt,
	badge,
	onDelete,
}: {
	title: string;
	href: string;
	ownerName?: string;
	ownerImage?: string | null;
	updatedAt: string;
	badge?: string;
	onDelete?: () => void;
}) {
	return (
		<a
			href={href}
			style={{
				display: "block",
				padding: 16,
				background: "#fff",
				borderRadius: 12,
				border: "1px solid #eee",
				textDecoration: "none",
				color: "#333",
				transition: "box-shadow 0.15s, transform 0.15s",
				position: "relative",
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)";
				e.currentTarget.style.transform = "translateY(-2px)";
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.boxShadow = "none";
				e.currentTarget.style.transform = "none";
			}}
		>
			<div
				style={{
					height: 80,
					background: "#f8f8f8",
					borderRadius: 8,
					marginBottom: 12,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: 24,
					color: "#ccc",
				}}
			>
				⌂
			</div>
			<div
				style={{
					fontWeight: 600,
					fontSize: 14,
					marginBottom: 4,
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
				}}
			>
				{title}
			</div>
			<div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#999" }}>
				{ownerImage && (
					<img src={ownerImage} alt="" style={{ width: 16, height: 16, borderRadius: "50%" }} />
				)}
				{ownerName && <span>{ownerName}</span>}
				{badge && (
					<span
						style={{
							background: "#f0f0f0",
							padding: "1px 6px",
							borderRadius: 3,
							fontSize: 10,
						}}
					>
						{badge}
					</span>
				)}
				<span style={{ marginLeft: "auto" }}>{new Date(updatedAt).toLocaleDateString()}</span>
			</div>
			{onDelete && (
				<button
					type="button"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						onDelete();
					}}
					style={{
						position: "absolute",
						top: 8,
						right: 8,
						width: 24,
						height: 24,
						border: "none",
						borderRadius: "50%",
						background: "rgba(255,255,255,0.9)",
						color: "#c33",
						fontSize: 12,
						cursor: "pointer",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					x
				</button>
			)}
		</a>
	);
}

export function CommunityPage() {
	const navigate = useNavigate();
	const { user: sessionUser, logout } = useAuth();
	const [myBoards, setMyBoards] = useState<Board[]>([]);
	const [publicBoards, setPublicBoards] = useState<DiscoverBoard[]>([]);
	const [locals, setLocals] = useState<LocalBoard[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const load = useCallback(async () => {
		setLocals(localBoards.list());
		setError("");
		setLoading(true);
		try {
			const [mine, discover] = await Promise.all([
				sessionUser ? api.boards.list().catch(() => [] as Board[]) : Promise.resolve([] as Board[]),
				api.boards.discover().catch(() => [] as DiscoverBoard[]),
			]);
			setMyBoards(mine);
			// discoverから自分のボードを除外
			const myIds = new Set(mine.map((b) => b.id));
			setPublicBoards(discover.filter((b) => !myIds.has(b.id)));
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load");
		} finally {
			setLoading(false);
		}
	}, [sessionUser]);

	useEffect(() => {
		load();
	}, [load]);

	const handleCreate = async () => {
		try {
			const board = await api.boards.create();
			navigate(`/boards/${board.id}`);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to create board");
		}
	};

	const handleCreateLocal = () => {
		const board = localBoards.create();
		navigate(`/local/${board.id}`);
	};

	const handleDelete = async (id: string) => {
		await api.boards.delete(id).catch(() => {});
		load();
	};

	const handleDeleteLocal = (id: string) => {
		localBoards.delete(id);
		setLocals(localBoards.list());
	};

	const gridStyle: React.CSSProperties = {
		display: "grid",
		gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
		gap: 16,
		marginBottom: 32,
	};

	return (
		<div
			style={{
				maxWidth: 1200,
				margin: "0 auto",
				padding: "24px 32px",
				fontFamily: "system-ui, sans-serif",
			}}
		>
			{/* Header */}
			<header
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: 32,
				}}
			>
				<div>
					<h1 style={{ fontSize: "1.5rem", margin: 0 }}>uSketch</h1>
					<p style={{ fontSize: 13, color: "#999", margin: "4px 0 0" }}>Community Space</p>
				</div>
				<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
					{sessionUser && <span style={{ fontSize: 14, color: "#666" }}>{sessionUser.name}</span>}
					{sessionUser ? (
						<button
							type="button"
							onClick={() => {
								logout();
								navigate("/login");
							}}
							style={{
								padding: "6px 12px",
								fontSize: 12,
								cursor: "pointer",
								border: "1px solid #ddd",
								borderRadius: 6,
								background: "#fff",
								color: "#333",
							}}
						>
							Sign Out
						</button>
					) : (
						<a
							href="/login"
							style={{
								padding: "6px 12px",
								fontSize: 12,
								textDecoration: "none",
								border: "1px solid #ddd",
								borderRadius: 6,
								color: "#333",
							}}
						>
							Sign In
						</a>
					)}
				</div>
			</header>

			{error && <p style={{ color: "#c33", marginBottom: 16 }}>{error}</p>}

			{/* Create buttons */}
			<div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
				{sessionUser && (
					<button
						type="button"
						onClick={handleCreate}
						style={{
							padding: "10px 20px",
							fontSize: 14,
							fontWeight: 600,
							cursor: "pointer",
							border: "none",
							borderRadius: 8,
							background: "#0066ff",
							color: "#fff",
						}}
					>
						New Cloud Board
					</button>
				)}
				<button
					type="button"
					onClick={handleCreateLocal}
					style={{
						padding: "10px 20px",
						fontSize: 14,
						fontWeight: 600,
						cursor: "pointer",
						border: "1px solid #0066ff",
						borderRadius: 8,
						background: "#fff",
						color: "#0066ff",
					}}
				>
					New Local Board
				</button>
			</div>

			{loading && <p style={{ color: "#999" }}>Loading...</p>}

			{/* My Boards */}
			{(myBoards.length > 0 || locals.length > 0) && (
				<>
					<h2 style={{ fontSize: "1.1rem", margin: "0 0 16px", color: "#333" }}>My Boards</h2>
					<div style={gridStyle}>
						{myBoards.map((b) => (
							<BoardCard
								key={b.id}
								title={b.title}
								href={`/boards/${b.id}`}
								updatedAt={b.updatedAt}
								badge={b.role ?? undefined}
								onDelete={b.role === "owner" ? () => handleDelete(b.id) : undefined}
							/>
						))}
						{locals.map((b) => (
							<BoardCard
								key={b.id}
								title={b.title}
								href={`/local/${b.id}`}
								updatedAt={b.updatedAt}
								badge="local"
								onDelete={() => handleDeleteLocal(b.id)}
							/>
						))}
					</div>
				</>
			)}

			{/* Discover */}
			{publicBoards.length > 0 && (
				<>
					<h2 style={{ fontSize: "1.1rem", margin: "0 0 16px", color: "#333" }}>
						Discover Public Boards
					</h2>
					<div style={gridStyle}>
						{publicBoards.map((b) => (
							<BoardCard
								key={b.id}
								title={b.title}
								href={`/boards/${b.id}`}
								ownerName={b.ownerName}
								ownerImage={b.ownerImage}
								updatedAt={b.updatedAt}
							/>
						))}
					</div>
				</>
			)}

			{!loading && myBoards.length === 0 && locals.length === 0 && publicBoards.length === 0 && (
				<div style={{ textAlign: "center", padding: 48, color: "#999" }}>
					<p style={{ fontSize: 18, marginBottom: 8 }}>No boards yet</p>
					<p style={{ fontSize: 13 }}>Create your first board to get started</p>
				</div>
			)}
		</div>
	);
}
