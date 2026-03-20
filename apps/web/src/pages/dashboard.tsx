import { useCallback, useEffect, useState } from "react";
import { api, type Board } from "../lib/api.js";
import { signOut, useSession } from "../lib/auth-client.js";

export function DashboardPage() {
	const { data: session } = useSession();
	const [boards, setBoards] = useState<Board[]>([]);
	const [loading, setLoading] = useState(true);

	const loadBoards = useCallback(async () => {
		try {
			const result = await api.boards.list();
			setBoards(result);
		} catch {
			// 未認証の場合は空リスト
			setBoards([]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadBoards();
	}, [loadBoards]);

	const handleCreate = async () => {
		const board = await api.boards.create();
		window.location.href = `/boards/${board.id}`;
	};

	const handleDelete = async (id: string) => {
		await api.boards.delete(id);
		loadBoards();
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
					{session?.user && (
						<span style={{ fontSize: "14px", color: "#666" }}>{session.user.name}</span>
					)}
					<button
						type="button"
						onClick={() =>
							signOut({
								fetchOptions: {
									onSuccess: () => {
										window.location.href = "/login";
									},
								},
							})
						}
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
				</div>
			</header>

			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "16px",
				}}
			>
				<h2 style={{ fontSize: "1.1rem", margin: 0 }}>Boards</h2>
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
					New Board
				</button>
			</div>

			{loading ? (
				<p style={{ color: "#999" }}>Loading...</p>
			) : boards.length === 0 ? (
				<p style={{ color: "#999" }}>No boards yet. Create one to get started.</p>
			) : (
				<div style={{ display: "grid", gap: "8px" }}>
					{boards.map((board) => (
						<div
							key={board.id}
							style={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								padding: "12px 16px",
								border: "1px solid #eee",
								borderRadius: "8px",
							}}
						>
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
		</div>
	);
}
