import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { api, type Board } from "../lib/api.js";
import { type LocalBoard, localBoards } from "../lib/local-boards.js";
import { useAuth } from "../lib/use-auth.js";

export function DashboardPage() {
	const navigate = useNavigate();
	const { user: sessionUser, logout } = useAuth();
	const [boards, setBoards] = useState<Board[]>([]);
	const [locals, setLocals] = useState<LocalBoard[]>([]);
	const [loading, setLoading] = useState(true);

	const [error, setError] = useState("");

	const loadBoards = useCallback(async () => {
		setLocals(localBoards.list());
		setError("");
		if (sessionUser) {
			setLoading(true);
			try {
				const result = await api.boards.list();
				setBoards(result);
			} catch (e) {
				const msg = e instanceof Error ? e.message : "Failed to load boards";
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
			setError(e instanceof Error ? e.message : "Failed to create board");
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
			setError(e instanceof Error ? e.message : "Failed to delete board");
		}
	};

	const handleDeleteLocal = (id: string) => {
		localBoards.delete(id);
		setLocals(localBoards.list());
	};

	const cardStyle = {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		padding: "12px 16px",
		border: "1px solid #eee",
		borderRadius: "8px",
	};

	return (
		<div
			style={{
				maxWidth: "800px",
				margin: "0 auto",
				padding: "24px",
				fontFamily: "system-ui, sans-serif",
			}}
		>
			<header
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "24px",
				}}
			>
				<h1 style={{ fontSize: "1.5rem", margin: 0 }}>uSketch</h1>
				<div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
					{sessionUser && (
						<span style={{ fontSize: "14px", color: "#666" }}>{sessionUser.name}</span>
					)}
					{sessionUser ? (
						<button
							type="button"
							onClick={() => {
								logout();
								navigate("/login");
							}}
							style={{
								padding: "6px 12px",
								fontSize: "12px",
								cursor: "pointer",
								border: "1px solid #ddd",
								borderRadius: "4px",
								background: "#fff",
							}}
						>
							Sign Out
						</button>
					) : (
						<a
							href="/login"
							style={{
								padding: "6px 12px",
								fontSize: "12px",
								textDecoration: "none",
								border: "1px solid #ddd",
								borderRadius: "4px",
								color: "#333",
							}}
						>
							Sign In
						</a>
					)}
				</div>
			</header>

			{/* Local Boards */}
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "16px",
				}}
			>
				<h2 style={{ fontSize: "1.1rem", margin: 0 }}>Local Boards</h2>
				<button
					type="button"
					onClick={handleCreateLocal}
					style={{
						padding: "8px 16px",
						fontSize: "14px",
						cursor: "pointer",
						border: "1px solid #0066ff",
						borderRadius: "6px",
						background: "#fff",
						color: "#0066ff",
					}}
				>
					New Local Board
				</button>
			</div>

			{locals.length === 0 ? (
				<p style={{ color: "#999", marginBottom: "24px" }}>
					No local boards. These are saved in your browser only.
				</p>
			) : (
				<div style={{ display: "grid", gap: "8px", marginBottom: "24px" }}>
					{locals.map((board) => (
						<div key={board.id} style={cardStyle}>
							<a
								href={`/local/${board.id}`}
								style={{ textDecoration: "none", color: "#333", fontWeight: 500 }}
							>
								{board.title}
							</a>
							<div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
								<span
									style={{
										fontSize: "11px",
										color: "#999",
										background: "#f5f5f5",
										padding: "2px 6px",
										borderRadius: "3px",
									}}
								>
									local
								</span>
								<span style={{ fontSize: "12px", color: "#999" }}>
									{new Date(board.updatedAt).toLocaleDateString()}
								</span>
								<button
									type="button"
									onClick={() => handleDeleteLocal(board.id)}
									style={{
										padding: "4px 8px",
										fontSize: "11px",
										cursor: "pointer",
										border: "1px solid #fcc",
										borderRadius: "4px",
										background: "#fff",
										color: "#c33",
									}}
								>
									Delete
								</button>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Cloud Boards */}
			{sessionUser && (
				<>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							marginBottom: "16px",
						}}
					>
						<h2 style={{ fontSize: "1.1rem", margin: 0 }}>Cloud Boards</h2>
						<button
							type="button"
							onClick={handleCreate}
							style={{
								padding: "8px 16px",
								fontSize: "14px",
								cursor: "pointer",
								border: "none",
								borderRadius: "6px",
								background: "#0066ff",
								color: "#fff",
							}}
						>
							New Cloud Board
						</button>
					</div>

					{error ? (
						<p style={{ color: "#c33" }}>{error}</p>
					) : loading ? (
						<p style={{ color: "#999" }}>Loading...</p>
					) : boards.length === 0 ? (
						<p style={{ color: "#999" }}>No cloud boards yet.</p>
					) : (
						<div style={{ display: "grid", gap: "8px" }}>
							{boards.map((board) => (
								<div key={board.id} style={cardStyle}>
									<a
										href={`/boards/${board.id}`}
										style={{ textDecoration: "none", color: "#333", fontWeight: 500 }}
									>
										{board.title}
									</a>
									<div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
										<span style={{ fontSize: "12px", color: "#999" }}>
											{new Date(board.updatedAt).toLocaleDateString()}
										</span>
										{board.role === "owner" && (
											<button
												type="button"
												onClick={() => handleDelete(board.id)}
												style={{
													padding: "4px 8px",
													fontSize: "11px",
													cursor: "pointer",
													border: "1px solid #fcc",
													borderRadius: "4px",
													background: "#fff",
													color: "#c33",
												}}
											>
												Delete
											</button>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</>
			)}
		</div>
	);
}
