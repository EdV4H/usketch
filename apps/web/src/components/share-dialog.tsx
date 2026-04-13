import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { getErrorMessage } from "../lib/errors.js";

interface Member {
	userId: string;
	role: string;
	name: string;
	image: string | null;
}

export function ShareDialog({ boardId, onClose }: { boardId: string; onClose: () => void }) {
	const [members, setMembers] = useState<Member[]>([]);
	const [isPublic, setIsPublic] = useState(false);
	const [email, setEmail] = useState("");
	const [error, setError] = useState("");
	const [copied, setCopied] = useState(false);

	const loadData = useCallback(async () => {
		try {
			const [memberList, board] = await Promise.all([
				api.boards.members(boardId),
				api.boards.get(boardId),
			]);
			setMembers(memberList);
			setIsPublic(board.isPublic);
		} catch {
			// ignore
		}
	}, [boardId]);

	useEffect(() => {
		loadData();
	}, [loadData]);

	const handleTogglePublic = async () => {
		try {
			const result = await api.boards.toggleShare(boardId);
			setIsPublic(result.isPublic);
		} catch (e) {
			setError(getErrorMessage(e, "Failed to toggle share"));
		}
	};

	const handleAddMember = async () => {
		if (!email.trim()) return;
		setError("");
		try {
			await api.boards.addMember(boardId, email.trim());
			setEmail("");
			loadData();
		} catch (e) {
			setError(getErrorMessage(e, "Failed to add member"));
		}
	};

	const handleRemoveMember = async (userId: string) => {
		try {
			await api.boards.removeMember(boardId, userId);
			loadData();
		} catch (e) {
			setError(getErrorMessage(e, "Failed to remove member"));
		}
	};

	const handleCopyLink = async () => {
		try {
			await navigator.clipboard.writeText(window.location.href);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			setError("Failed to copy link");
		}
	};

	// Escapeキーで閉じる
	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [onClose]);

	return (
		<>
			{/* Backdrop */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-dismiss */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: handled by Escape key in dialog */}
			<div
				onClick={onClose}
				style={{
					position: "fixed",
					inset: 0,
					background: "rgba(0,0,0,0.3)",
					zIndex: 200,
				}}
			/>
			{/* Dialog */}
			<div
				style={{
					position: "fixed",
					top: "50%",
					left: "50%",
					transform: "translate(-50%, -50%)",
					background: "#fff",
					borderRadius: 12,
					padding: 24,
					width: 400,
					maxHeight: "80vh",
					overflow: "auto",
					zIndex: 201,
					boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
					fontFamily: "system-ui, sans-serif",
				}}
			>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginBottom: 16,
					}}
				>
					<h2 style={{ margin: 0, fontSize: 18 }}>Share Board</h2>
					<button type="button" onClick={onClose} style={closeBtnStyle}>
						✕
					</button>
				</div>

				{/* Public link toggle */}
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						padding: "12px 0",
						borderBottom: "1px solid #eee",
					}}
				>
					<div>
						<div style={{ fontWeight: 500, fontSize: 14 }}>Public link</div>
						<div style={{ fontSize: 12, color: "#888" }}>
							{isPublic ? "Anyone with the link can view" : "Only members can access"}
						</div>
					</div>
					<button
						type="button"
						onClick={handleTogglePublic}
						style={{
							padding: "6px 12px",
							border: "none",
							borderRadius: 6,
							background: isPublic ? "#0066ff" : "#e0e0e0",
							color: isPublic ? "#fff" : "#333",
							cursor: "pointer",
							fontSize: 12,
						}}
					>
						{isPublic ? "On" : "Off"}
					</button>
				</div>

				{/* Copy link */}
				<button
					type="button"
					onClick={handleCopyLink}
					style={{
						width: "100%",
						padding: "10px 0",
						border: "1px solid #ddd",
						borderRadius: 6,
						background: "#fafafa",
						cursor: "pointer",
						fontSize: 13,
						marginTop: 12,
					}}
				>
					{copied ? "Copied!" : "Copy link"}
				</button>

				{/* Add member */}
				<div style={{ marginTop: 16 }}>
					<div style={{ fontWeight: 500, fontSize: 14, marginBottom: 8 }}>Members</div>
					<div style={{ display: "flex", gap: 8 }}>
						<input
							type="email"
							placeholder="Email address"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && handleAddMember()}
							style={{
								flex: 1,
								padding: "8px 10px",
								border: "1px solid #ddd",
								borderRadius: 6,
								fontSize: 13,
							}}
						/>
						<button
							type="button"
							onClick={handleAddMember}
							style={{
								padding: "8px 14px",
								border: "none",
								borderRadius: 6,
								background: "#0066ff",
								color: "#fff",
								cursor: "pointer",
								fontSize: 13,
							}}
						>
							Add
						</button>
					</div>
					{error && <p style={{ color: "#c33", fontSize: 12, margin: "4px 0 0" }}>{error}</p>}
				</div>

				{/* Member list */}
				<div style={{ marginTop: 12, display: "grid", gap: 4 }}>
					{members.map((m) => (
						<div
							key={m.userId}
							style={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								padding: "8px 0",
								borderBottom: "1px solid #f5f5f5",
							}}
						>
							<div>
								<div style={{ fontSize: 13, fontWeight: 500 }}>{m.name || "Unknown"}</div>
								<div style={{ fontSize: 11, color: "#888" }}>{m.role}</div>
							</div>
							{m.role !== "owner" && (
								<button
									type="button"
									onClick={() => handleRemoveMember(m.userId)}
									style={{
										padding: "4px 8px",
										border: "1px solid #fcc",
										borderRadius: 4,
										background: "#fff",
										color: "#c33",
										cursor: "pointer",
										fontSize: 11,
									}}
								>
									Remove
								</button>
							)}
						</div>
					))}
				</div>
			</div>
		</>
	);
}

const closeBtnStyle: React.CSSProperties = {
	background: "none",
	border: "none",
	fontSize: 18,
	cursor: "pointer",
	color: "#888",
	padding: 4,
};
