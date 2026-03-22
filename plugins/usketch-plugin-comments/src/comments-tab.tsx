import type { EventBus } from "@edv4h/usketch-shared";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CommentClient } from "./comment-client.js";
import type { CommentThread } from "./types.js";

interface CommentsTabProps {
	client: CommentClient;
	events: EventBus;
	focusThreadId: string | null;
}

function formatTime(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ThreadItem({
	thread,
	isFocused,
	onReply,
	onResolve,
	onDelete,
}: {
	thread: CommentThread;
	isFocused: boolean;
	onReply: (threadId: string, text: string) => void;
	onResolve: (threadId: string, resolved: boolean) => void;
	onDelete: (threadId: string) => void;
}) {
	const [replyText, setReplyText] = useState("");
	const [isComposing, setIsComposing] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const threadRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (isFocused && threadRef.current) {
			threadRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
		}
	}, [isFocused]);

	const handleSubmit = useCallback(() => {
		const text = replyText.trim();
		if (!text) return;
		onReply(thread.id, text);
		setReplyText("");
	}, [replyText, thread.id, onReply]);

	return (
		<div
			ref={threadRef}
			style={{
				padding: "12px 16px",
				borderBottom: "1px solid #f0f0f0",
				background: isFocused ? "#f8f9ff" : "transparent",
			}}
		>
			{/* ヘッダー */}
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: 8,
				}}
			>
				<span style={{ fontSize: 11, color: "#999" }}>
					on shape {thread.anchorShapeId.slice(0, 8)}…
				</span>
				<div style={{ display: "flex", gap: 4 }}>
					<button
						type="button"
						onClick={() => onResolve(thread.id, !thread.resolved)}
						title={thread.resolved ? "Reopen" : "Resolve"}
						style={{
							border: "none",
							background: "none",
							cursor: "pointer",
							fontSize: 14,
							color: thread.resolved ? "#16a34a" : "#999",
							padding: "2px 4px",
						}}
					>
						{thread.resolved ? "✓" : "○"}
					</button>
					<button
						type="button"
						onClick={() => onDelete(thread.id)}
						title="Delete thread"
						style={{
							border: "none",
							background: "none",
							cursor: "pointer",
							fontSize: 12,
							color: "#ccc",
							padding: "2px 4px",
						}}
					>
						🗑
					</button>
				</div>
			</div>

			{/* メッセージ一覧 */}
			{thread.messages.map((msg) => (
				<div key={msg.id} style={{ marginBottom: 6 }}>
					<div style={{ fontSize: 13, color: "#333", lineHeight: 1.4 }}>{msg.text}</div>
					<div style={{ fontSize: 10, color: "#bbb", marginTop: 2 }}>
						{msg.authorId.slice(0, 8)}… · {formatTime(msg.createdAt)}
					</div>
				</div>
			))}

			{/* 返信入力 */}
			{!thread.resolved && (
				<div style={{ display: "flex", gap: 6, marginTop: 8 }}>
					<input
						ref={inputRef}
						type="text"
						value={replyText}
						onChange={(e) => setReplyText(e.target.value)}
						onCompositionStart={() => setIsComposing(true)}
						onCompositionEnd={() => setIsComposing(false)}
						onKeyDown={(e) => {
							e.stopPropagation();
							if (e.key === "Enter" && !isComposing) handleSubmit();
						}}
						placeholder="Reply…"
						style={{
							flex: 1,
							border: "1px solid #e5e5e5",
							borderRadius: 6,
							padding: "6px 10px",
							fontSize: 12,
							outline: "none",
							fontFamily: "inherit",
						}}
					/>
					<button
						type="button"
						onClick={handleSubmit}
						style={{
							border: "none",
							background: "#1e1e1e",
							color: "#fff",
							borderRadius: 6,
							padding: "6px 10px",
							fontSize: 12,
							cursor: "pointer",
							flexShrink: 0,
						}}
					>
						Send
					</button>
				</div>
			)}
		</div>
	);
}

interface NewThreadPrompt {
	anchorShapeId: string;
	anchorX: number;
	anchorY: number;
}

function NewThreadForm({
	prompt,
	onSubmit,
	onCancel,
}: {
	prompt: NewThreadPrompt;
	onSubmit: (text: string) => void;
	onCancel: () => void;
}) {
	const [text, setText] = useState("");
	const [isComposing, setIsComposing] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	return (
		<div style={{ padding: "12px 16px", borderBottom: "1px solid #eee", background: "#f8f9ff" }}>
			<div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
				New comment on shape {prompt.anchorShapeId.slice(0, 8)}…
			</div>
			<div style={{ display: "flex", gap: 6 }}>
				<input
					ref={inputRef}
					type="text"
					value={text}
					onChange={(e) => setText(e.target.value)}
					onCompositionStart={() => setIsComposing(true)}
					onCompositionEnd={() => setIsComposing(false)}
					onKeyDown={(e) => {
						e.stopPropagation();
						if (e.key === "Enter" && !isComposing && text.trim()) onSubmit(text.trim());
						if (e.key === "Escape") onCancel();
					}}
					placeholder="Write a comment…"
					style={{
						flex: 1,
						border: "1px solid #e5e5e5",
						borderRadius: 6,
						padding: "6px 10px",
						fontSize: 12,
						outline: "none",
						fontFamily: "inherit",
					}}
				/>
				<button
					type="button"
					onClick={() => text.trim() && onSubmit(text.trim())}
					style={{
						border: "none",
						background: "#1e1e1e",
						color: "#fff",
						borderRadius: 6,
						padding: "6px 10px",
						fontSize: 12,
						cursor: "pointer",
						flexShrink: 0,
					}}
				>
					Post
				</button>
			</div>
		</div>
	);
}

export function CommentsTab({ client, events, focusThreadId }: CommentsTabProps) {
	const [threads, setThreads] = useState<CommentThread[]>([]);
	const [loading, setLoading] = useState(true);
	const [newThreadPrompt, setNewThreadPrompt] = useState<NewThreadPrompt | null>(null);
	const fetchedRef = useRef(false);

	useEffect(() => {
		if (fetchedRef.current) return;
		fetchedRef.current = true;
		client
			.list()
			.then((loaded) => {
				setThreads(loaded);
				// バッジレイヤーにもデータを共有
				events.emit("comments:threads-loaded", loaded);
			})
			.finally(() => setLoading(false));
	}, [client, events]);

	// 新規スレッド作成プロンプトをリッスン
	useEffect(() => {
		return events.on<NewThreadPrompt>("comments:prompt-new-thread", (prompt) => {
			setNewThreadPrompt(prompt);
		});
	}, [events]);

	// バッジレイヤーにスレッド一覧を同期
	const syncBadges = useCallback(
		(updated: CommentThread[]) => {
			events.emit("comments:threads-loaded", updated);
		},
		[events],
	);

	const handleReply = useCallback(
		async (threadId: string, text: string) => {
			const msg = await client.addMessage(threadId, text);
			if (!msg) return;
			setThreads((prev) => {
				const updated = prev.map((t) =>
					t.id === threadId ? { ...t, messages: [...t.messages, msg] } : t,
				);
				syncBadges(updated);
				return updated;
			});
		},
		[client, syncBadges],
	);

	const handleResolve = useCallback(
		async (threadId: string, resolved: boolean) => {
			const ok = await client.resolve(threadId, resolved);
			if (!ok) return;
			setThreads((prev) => {
				const updated = prev.map((t) =>
					t.id === threadId ? { ...t, resolved: resolved ? 1 : 0 } : t,
				);
				syncBadges(updated);
				return updated;
			});
		},
		[client, syncBadges],
	);

	const handleDelete = useCallback(
		async (threadId: string) => {
			const ok = await client.deleteThread(threadId);
			if (!ok) return;
			setThreads((prev) => {
				const updated = prev.filter((t) => t.id !== threadId);
				syncBadges(updated);
				return updated;
			});
		},
		[client, syncBadges],
	);

	const handleCreateThread = useCallback(
		async (text: string) => {
			if (!newThreadPrompt) return;
			const thread = await client.createThread({
				anchorShapeId: newThreadPrompt.anchorShapeId,
				anchorX: newThreadPrompt.anchorX,
				anchorY: newThreadPrompt.anchorY,
				text,
			});
			if (thread) {
				setThreads((prev) => [thread, ...prev]);
				// バッジレイヤー用にイベント発火（タブ内のリスナーはスキップ）
				events.emit("comments:badge-update", thread);
			}
			setNewThreadPrompt(null);
		},
		[client, newThreadPrompt, events],
	);

	if (loading) {
		return (
			<div style={{ padding: 16, textAlign: "center", color: "#999", fontSize: 13 }}>
				Loading comments…
			</div>
		);
	}

	return (
		<div>
			{newThreadPrompt && (
				<NewThreadForm
					prompt={newThreadPrompt}
					onSubmit={handleCreateThread}
					onCancel={() => setNewThreadPrompt(null)}
				/>
			)}
			{threads.length === 0 && !newThreadPrompt ? (
				<div style={{ padding: 24, textAlign: "center", color: "#999", fontSize: 13 }}>
					No comments yet. Select a shape and click 💬 Comment to start a thread.
				</div>
			) : (
				threads.map((thread) => (
					<ThreadItem
						key={thread.id}
						thread={thread}
						isFocused={focusThreadId === thread.id}
						onReply={handleReply}
						onResolve={handleResolve}
						onDelete={handleDelete}
					/>
				))
			)}
		</div>
	);
}
