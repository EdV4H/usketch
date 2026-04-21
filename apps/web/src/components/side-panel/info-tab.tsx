import { useEffect, useState } from "react";
import { getDevUser } from "../../lib/dev-auth.js";
import { I } from "../ui/index.js";

interface BoardInfo {
	id: string;
	name: string;
	isPublic: number;
	ownerId: string;
}

interface Member {
	userId: string;
	role: string;
	name?: string | null;
}

interface Props {
	boardId: string;
	apiUrl: string;
}

function buildHeaders(): HeadersInit {
	const headers: Record<string, string> = {};
	if (import.meta.env.DEV) {
		const devUser = getDevUser();
		if (devUser) headers["X-User-Id"] = devUser.id;
	}
	return headers;
}

export function InfoTab({ boardId, apiUrl }: Props) {
	const [board, setBoard] = useState<BoardInfo | null>(null);
	const [members, setMembers] = useState<Member[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);

		const headers = buildHeaders();

		Promise.all([
			fetch(`${apiUrl}/api/boards/${boardId}`, { credentials: "include", headers })
				.then((r) => (r.ok ? r.json() : null))
				.catch(() => null),
			fetch(`${apiUrl}/api/boards/${boardId}/members`, { credentials: "include", headers })
				.then((r) => (r.ok ? r.json() : []))
				.catch(() => [] as Member[]),
		]).then(([b, m]) => {
			if (cancelled) return;
			setBoard(b as BoardInfo | null);
			setMembers(m as Member[]);
			setLoading(false);
		});

		return () => {
			cancelled = true;
		};
	}, [boardId, apiUrl]);

	if (loading) {
		return <div style={placeholderStyle}>読み込み中…</div>;
	}

	if (!board) {
		return <div style={placeholderStyle}>ボード情報を取得できませんでした</div>;
	}

	return (
		<div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 16 }}>
			<Section title="ボード">
				<Row label="名前" value={board.name} />
				<Row label="ID" value={board.id} mono />
				<Row
					label="公開範囲"
					value={
						<span
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: 5,
								color: board.isPublic ? "var(--success)" : "var(--fg-secondary)",
							}}
						>
							{board.isPublic ? <I.globe size={12} /> : <I.lock size={12} />}
							{board.isPublic ? "公開" : "非公開"}
						</span>
					}
				/>
			</Section>

			<Section title={`メンバー (${members.length})`}>
				{members.length === 0 ? (
					<div style={{ fontSize: 12, color: "var(--fg-tertiary)" }}>メンバーはいません</div>
				) : (
					members.map((m) => (
						<div
							key={m.userId}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 8,
								padding: "6px 0",
								borderBottom: "1px solid var(--border-subtle)",
							}}
						>
							<div
								style={{
									width: 24,
									height: 24,
									borderRadius: "50%",
									background: "var(--brand-gradient)",
									color: "white",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									fontSize: 11,
									fontWeight: 600,
									flexShrink: 0,
								}}
							>
								{(m.name ?? m.userId).charAt(0).toUpperCase()}
							</div>
							<div style={{ flex: 1, minWidth: 0 }}>
								<div
									style={{
										fontSize: 12,
										fontWeight: 500,
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
										color: "var(--fg-primary)",
									}}
								>
									{m.name ?? m.userId}
								</div>
								<div
									style={{
										fontSize: 10.5,
										color: "var(--fg-tertiary)",
										fontFamily: "var(--font-mono)",
									}}
								>
									{m.role}
								</div>
							</div>
						</div>
					))
				)}
			</Section>
		</div>
	);
}

const placeholderStyle: React.CSSProperties = {
	padding: 20,
	textAlign: "center",
	color: "var(--fg-tertiary)",
	fontSize: 12,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div>
			<div
				style={{
					fontSize: 10.5,
					fontWeight: 600,
					color: "var(--fg-tertiary)",
					textTransform: "uppercase",
					letterSpacing: 0.4,
					marginBottom: 8,
				}}
			>
				{title}
			</div>
			<div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{children}</div>
		</div>
	);
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
	return (
		<div
			style={{
				display: "flex",
				justifyContent: "space-between",
				alignItems: "center",
				padding: "6px 0",
				borderBottom: "1px solid var(--border-subtle)",
				gap: 8,
			}}
		>
			<span style={{ fontSize: 11.5, color: "var(--fg-secondary)" }}>{label}</span>
			<span
				style={{
					fontSize: 12,
					color: "var(--fg-primary)",
					fontFamily: mono ? "var(--font-mono)" : "inherit",
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
					maxWidth: "60%",
					textAlign: "right",
				}}
			>
				{value}
			</span>
		</div>
	);
}
