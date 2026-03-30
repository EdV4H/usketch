import { type BoardStore, DEFAULT_STYLE } from "@edv4h/usketch-shared";
import { useCallback, useEffect, useState } from "react";
import type { BoardInfoClient } from "./board-info-client.js";
import type { BoardInfo, BoardListItem, BoardMember } from "./types.js";

interface BoardInfoTabProps {
	boardId: string | null;
	client: BoardInfoClient;
	store: BoardStore;
	onOpenBoard: (boardId: string) => void;
}

export function BoardInfoTab({ boardId, client, store, onOpenBoard }: BoardInfoTabProps) {
	const [board, setBoard] = useState<BoardInfo | null>(null);
	const [members, setMembers] = useState<BoardMember[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const loadBoardInfo = useCallback(
		async (id: string) => {
			setLoading(true);
			setError(null);
			try {
				const [boardData, memberData] = await Promise.all([
					client.getBoard(id),
					client.getMembers(id).catch(() => [] as BoardMember[]),
				]);
				setBoard(boardData);
				setMembers(memberData);
			} catch (e) {
				setError(e instanceof Error ? e.message : "Failed to load board info");
			} finally {
				setLoading(false);
			}
		},
		[client],
	);

	useEffect(() => {
		if (!boardId) {
			setBoard(null);
			setMembers([]);
			return;
		}
		loadBoardInfo(boardId);
	}, [boardId, loadBoardInfo]);

	if (!boardId) {
		return <BoardListView client={client} store={store} onOpenBoard={onOpenBoard} />;
	}

	if (loading) {
		return (
			<div style={styles.empty}>
				<p style={styles.emptyText}>Loading...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div style={styles.empty}>
				<p style={{ ...styles.emptyText, color: "#c33" }}>{error}</p>
			</div>
		);
	}

	if (!board) return null;

	const onlineMembers = members.filter((m) => m.status === "online");
	const offlineMembers = members.filter((m) => m.status !== "online");

	return (
		<div style={styles.container}>
			{/* Board Info Section */}
			<div style={styles.section}>
				<div style={styles.titleRow}>
					<h3 style={styles.title}>{board.title}</h3>
					<span style={board.isPublic ? styles.badgePublic : styles.badgePrivate}>
						{board.isPublic ? "Public" : "Private"}
					</span>
				</div>
				{board.description && <p style={styles.description}>{board.description}</p>}
				<p style={styles.meta}>Created {new Date(board.createdAt).toLocaleDateString()}</p>
			</div>

			{/* Open Board Button */}
			<div style={styles.section}>
				<button type="button" onClick={() => onOpenBoard(board.id)} style={styles.openButton}>
					Open Board
				</button>
			</div>

			{/* Members Section */}
			<div style={styles.section}>
				<h4 style={styles.sectionTitle}>Members ({members.length})</h4>

				{onlineMembers.length > 0 && (
					<div style={styles.memberGroup}>
						<p style={styles.memberGroupLabel}>Online ({onlineMembers.length})</p>
						{onlineMembers.map((m) => (
							<MemberRow key={m.userId} member={m} />
						))}
					</div>
				)}

				{offlineMembers.length > 0 && (
					<div style={styles.memberGroup}>
						<p style={styles.memberGroupLabel}>Offline ({offlineMembers.length})</p>
						{offlineMembers.map((m) => (
							<MemberRow key={m.userId} member={m} />
						))}
					</div>
				)}

				{members.length === 0 && <p style={styles.emptyText}>No members</p>}
			</div>
		</div>
	);
}

/* ── ボード一覧（未選択時） ── */

function BoardListView({
	client,
	store,
	onOpenBoard,
}: {
	client: BoardInfoClient;
	store: BoardStore;
	onOpenBoard: (boardId: string) => void;
}) {
	const [boards, setBoards] = useState<BoardListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		client
			.listBoards()
			.then((data) => {
				if (!cancelled) setBoards(data);
			})
			.catch((e) => {
				if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load boards");
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [client]);

	/** 既にキャンバスにポータルがあるボードID一覧 */
	function getExistingPortalBoardIds(): Set<string> {
		const ids = new Set<string>();
		for (const [, shape] of store.getShapes()) {
			if (shape.type === "board-portal" && shape.boardId) {
				ids.add(shape.boardId as string);
			}
		}
		return ids;
	}

	/** ビューポート中央にboard-portalシェイプを追加 */
	function addPortalToCanvas(board: BoardListItem) {
		const vp = store.getViewport();
		const w = 240;
		const h = 160;
		// ビューポートの世界座標系での左上位置
		const worldLeft = -vp.x / vp.zoom;
		const worldTop = -vp.y / vp.zoom;
		// ビューポート中央の世界座標にポータルを配置
		const cx = worldLeft + window.innerWidth / 2 / vp.zoom - w / 2;
		const cy = worldTop + window.innerHeight / 2 / vp.zoom - h / 2;

		store.addShape({
			id: crypto.randomUUID(),
			type: "board-portal",
			x: cx,
			y: cy,
			width: w,
			height: h,
			rotation: 0,
			boardId: board.id,
			boardTitle: board.title,
			ownerName: "",
			ownerImage: "",
			memberCount: 0,
			isPublic: board.isPublic,
			thumbnailUrl: board.isPublic ? client.getThumbnailUrl(board.id) : undefined,
			style: DEFAULT_STYLE,
		});
	}

	if (loading) {
		return (
			<div style={styles.empty}>
				<p style={styles.emptyText}>Loading...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div style={styles.empty}>
				<p style={{ ...styles.emptyText, color: "#c33" }}>{error}</p>
			</div>
		);
	}

	const existingIds = getExistingPortalBoardIds();

	function handleDelete(boardId: string) {
		client
			.deleteBoard(boardId)
			.then(() => {
				setBoards((prev) => prev.filter((b) => b.id !== boardId));
			})
			.catch((e) => {
				setError(e instanceof Error ? e.message : "Failed to delete board");
			});
	}

	return (
		<div style={styles.container}>
			<h4 style={{ ...styles.sectionTitle, marginBottom: 12 }}>My Boards</h4>
			{boards.length === 0 ? (
				<p style={styles.emptyText}>No boards yet</p>
			) : (
				<div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
					{boards.map((b) => {
						const alreadyOnCanvas = existingIds.has(b.id);
						return (
							<div key={b.id} style={styles.boardRow}>
								<button
									type="button"
									onClick={() => {
										if (alreadyOnCanvas) {
											onOpenBoard(b.id);
										} else {
											addPortalToCanvas(b);
										}
									}}
									style={styles.boardRowClickable}
								>
									<div style={{ flex: 1, overflow: "hidden" }}>
										<div style={styles.boardRowTitle}>{b.title}</div>
										<div style={styles.boardRowMeta}>
											{new Date(b.updatedAt).toLocaleDateString()}
											{b.role && <span> · {b.role}</span>}
										</div>
									</div>
									{alreadyOnCanvas ? (
										<span style={styles.badgeOnCanvas}>On canvas</span>
									) : (
										<span style={styles.badgeAdd}>+ Add</span>
									)}
								</button>
								{b.role === "owner" && (
									<button
										type="button"
										onClick={() => handleDelete(b.id)}
										style={styles.deleteButton}
										title="Delete board"
									>
										✕
									</button>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

function MemberRow({ member }: { member: BoardMember }) {
	return (
		<div style={styles.memberRow}>
			<div style={styles.memberAvatar}>
				{member.image ? (
					<img src={member.image} alt={member.name} style={styles.avatarImg} />
				) : (
					<span style={styles.avatarFallback}>{member.name.charAt(0).toUpperCase()}</span>
				)}
				<span
					style={{
						...styles.statusDot,
						background: member.status === "online" ? "#22c55e" : "#94a3b8",
					}}
				/>
			</div>
			<div style={styles.memberInfo}>
				<span style={styles.memberName}>{member.name}</span>
				<span style={styles.memberRole}>{member.role}</span>
			</div>
		</div>
	);
}

const styles = {
	container: {
		padding: "12px 16px",
		fontFamily: "system-ui, sans-serif",
		fontSize: 13,
		overflowY: "auto" as const,
		height: "100%",
	},
	empty: {
		padding: "24px 16px",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		height: "100%",
	},
	emptyText: {
		color: "#94a3b8",
		fontSize: 13,
		textAlign: "center" as const,
	},
	section: {
		marginBottom: 16,
		paddingBottom: 16,
		borderBottom: "1px solid #f1f5f9",
	},
	titleRow: {
		display: "flex",
		alignItems: "center",
		gap: 8,
		marginBottom: 4,
	},
	title: {
		margin: 0,
		fontSize: 15,
		fontWeight: 600,
		color: "#1e293b",
		flex: 1,
		overflow: "hidden" as const,
		textOverflow: "ellipsis" as const,
		whiteSpace: "nowrap" as const,
	},
	badgePublic: {
		fontSize: 10,
		padding: "2px 6px",
		borderRadius: 4,
		background: "#dcfce7",
		color: "#16a34a",
		fontWeight: 600,
		flexShrink: 0,
	},
	badgePrivate: {
		fontSize: 10,
		padding: "2px 6px",
		borderRadius: 4,
		background: "#fef9c3",
		color: "#a16207",
		fontWeight: 600,
		flexShrink: 0,
	},
	description: {
		margin: "4px 0 0",
		color: "#64748b",
		lineHeight: 1.4,
	},
	meta: {
		margin: "8px 0 0",
		color: "#94a3b8",
		fontSize: 11,
	},
	openButton: {
		width: "100%",
		padding: "8px 16px",
		fontSize: 13,
		fontWeight: 600,
		cursor: "pointer",
		border: "none",
		borderRadius: 8,
		background: "#3b82f6",
		color: "#fff",
	},
	sectionTitle: {
		margin: "0 0 8px",
		fontSize: 12,
		fontWeight: 600,
		color: "#64748b",
		textTransform: "uppercase" as const,
		letterSpacing: "0.05em",
	},
	memberGroup: {
		marginBottom: 8,
	},
	memberGroupLabel: {
		margin: "0 0 4px",
		fontSize: 11,
		color: "#94a3b8",
		fontWeight: 500,
	},
	memberRow: {
		display: "flex",
		alignItems: "center",
		gap: 8,
		padding: "4px 0",
	},
	memberAvatar: {
		position: "relative" as const,
		width: 28,
		height: 28,
		flexShrink: 0,
	},
	avatarImg: {
		width: 28,
		height: 28,
		borderRadius: "50%",
		objectFit: "cover" as const,
	},
	avatarFallback: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		width: 28,
		height: 28,
		borderRadius: "50%",
		background: "#e2e8f0",
		color: "#64748b",
		fontSize: 12,
		fontWeight: 600,
	},
	statusDot: {
		position: "absolute" as const,
		bottom: 0,
		right: 0,
		width: 8,
		height: 8,
		borderRadius: "50%",
		border: "2px solid #fff",
	},
	memberInfo: {
		display: "flex",
		flexDirection: "column" as const,
		gap: 1,
		overflow: "hidden" as const,
	},
	memberName: {
		fontWeight: 500,
		color: "#1e293b",
		overflow: "hidden" as const,
		textOverflow: "ellipsis" as const,
		whiteSpace: "nowrap" as const,
	},
	memberRole: {
		fontSize: 11,
		color: "#94a3b8",
	},
	boardRow: {
		display: "flex",
		alignItems: "center",
		gap: 4,
		padding: "0 0 0 0",
		border: "1px solid #f1f5f9",
		borderRadius: 8,
		background: "#fff",
		overflow: "hidden" as const,
	},
	boardRowClickable: {
		display: "flex",
		alignItems: "center",
		gap: 8,
		flex: 1,
		padding: "8px 12px",
		border: "none",
		background: "none",
		cursor: "pointer",
		textAlign: "left" as const,
		fontFamily: "system-ui, sans-serif",
		overflow: "hidden" as const,
	},
	deleteButton: {
		border: "none",
		background: "none",
		cursor: "pointer",
		color: "#cbd5e1",
		fontSize: 12,
		padding: "8px 10px",
		flexShrink: 0,
	},
	boardRowTitle: {
		fontSize: 13,
		fontWeight: 500,
		color: "#1e293b",
		overflow: "hidden" as const,
		textOverflow: "ellipsis" as const,
		whiteSpace: "nowrap" as const,
	},
	boardRowMeta: {
		fontSize: 11,
		color: "#94a3b8",
		marginTop: 2,
	},
	badgeOnCanvas: {
		fontSize: 10,
		padding: "2px 6px",
		borderRadius: 4,
		background: "#e0f2fe",
		color: "#0284c7",
		fontWeight: 600,
		flexShrink: 0,
	},
	badgeAdd: {
		fontSize: 10,
		padding: "2px 8px",
		borderRadius: 4,
		background: "#3b82f6",
		color: "#fff",
		fontWeight: 600,
		flexShrink: 0,
	},
} as const;
