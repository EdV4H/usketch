import type { WsProviderHandle } from "@edv4h/usketch-sync";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatClient } from "./chat-client.js";
import type { ChatMessage } from "./types.js";

export interface ChatTabProps {
	client: ChatClient;
	wsProvider: WsProviderHandle | null;
	userId: string;
	userName: string;
	threadId: string;
}

const LOAD_LIMIT = 50;

export function ChatTab({ client, wsProvider, userId, userName, threadId }: ChatTabProps) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState("");
	const [isComposing, setIsComposing] = useState(false);
	const [isSending, setIsSending] = useState(false);
	const [hasMore, setHasMore] = useState(true);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const isInitialLoad = useRef(true);
	const messagesRef = useRef(messages);
	messagesRef.current = messages;

	const scrollToBottom = useCallback(() => {
		requestAnimationFrame(() => {
			if (scrollRef.current) {
				scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
			}
		});
	}, []);

	// threadId が変わったらメッセージをリセットして再取得
	useEffect(() => {
		let cancelled = false;
		setMessages([]);
		setHasMore(true);
		isInitialLoad.current = true;

		client.list(threadId, LOAD_LIMIT).then((msgs) => {
			if (cancelled) return;
			setMessages(msgs);
			setHasMore(msgs.length >= LOAD_LIMIT);
			isInitialLoad.current = false;
			scrollToBottom();
		});
		return () => {
			cancelled = true;
		};
	}, [client, threadId, scrollToBottom]);

	// WebSocket broadcast でリアルタイム受信（同じスレッドのみ）
	useEffect(() => {
		if (!wsProvider) return;
		return wsProvider.onBroadcast((msg) => {
			if (msg.kind !== "chat-message") return;
			const chatMsg = msg as unknown as { kind: string; message: ChatMessage };
			if (chatMsg.message.threadId !== threadId) return;
			if (chatMsg.message.authorId === userId) return;
			setMessages((prev) => [...prev, chatMsg.message]);
			scrollToBottom();
		});
	}, [wsProvider, userId, threadId, scrollToBottom]);

	// 上スクロールで過去メッセージ読み込み
	const handleScroll = useCallback(() => {
		if (!scrollRef.current || !hasMore || isLoadingMore) return;
		if (scrollRef.current.scrollTop > 50) return;

		const oldest = messagesRef.current[0];
		if (!oldest) return;

		setIsLoadingMore(true);
		const el = scrollRef.current;
		const prevHeight = el.scrollHeight;

		client.list(threadId, LOAD_LIMIT, oldest.createdAt).then((older) => {
			if (older.length < LOAD_LIMIT) setHasMore(false);
			if (older.length > 0) {
				setMessages((prev) => [...older, ...prev]);
				requestAnimationFrame(() => {
					el.scrollTop = el.scrollHeight - prevHeight;
				});
			}
			setIsLoadingMore(false);
		});
	}, [client, threadId, hasMore, isLoadingMore]);

	const handleSend = useCallback(async () => {
		const text = input.trim();
		if (!text || isSending) return;

		setIsSending(true);
		setInput("");

		const saved = await client.send(threadId, text, userName);
		if (saved) {
			setMessages((prev) => [...prev, saved]);
			scrollToBottom();
			wsProvider?.broadcast({ kind: "chat-message", message: saved });
		}
		setIsSending(false);
	}, [input, isSending, client, threadId, userName, wsProvider, scrollToBottom]);

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 300 }}>
			{/* メッセージ一覧 */}
			<div
				ref={scrollRef}
				onScroll={handleScroll}
				style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}
			>
				{isLoadingMore && (
					<div style={{ textAlign: "center", color: "#999", fontSize: 12, padding: "8px 0" }}>
						Loading...
					</div>
				)}
				{messages.length === 0 && !isInitialLoad.current && (
					<div style={{ textAlign: "center", color: "#999", fontSize: 13, padding: "24px 0" }}>
						No messages yet. Start the conversation!
					</div>
				)}
				{messages.map((msg) => {
					const isOwn = msg.authorId === userId;
					return (
						<div
							key={msg.id}
							style={{
								marginBottom: 10,
								display: "flex",
								flexDirection: "column",
								alignItems: isOwn ? "flex-end" : "flex-start",
							}}
						>
							{!isOwn && (
								<div style={{ fontSize: 11, color: "#888", marginBottom: 2, padding: "0 4px" }}>
									{msg.authorName}
								</div>
							)}
							<div
								style={{
									maxWidth: "85%",
									padding: "8px 12px",
									borderRadius: isOwn ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
									background: isOwn ? "#1e1e1e" : "#f0f0f0",
									color: isOwn ? "#fff" : "#333",
									fontSize: 13,
									lineHeight: 1.5,
									wordBreak: "break-word",
								}}
							>
								{msg.text}
							</div>
							<div style={{ fontSize: 10, color: "#bbb", marginTop: 2, padding: "0 4px" }}>
								{new Date(msg.createdAt).toLocaleTimeString([], {
									hour: "2-digit",
									minute: "2-digit",
								})}
							</div>
						</div>
					);
				})}
			</div>

			{/* 入力欄 */}
			<div
				style={{
					borderTop: "1px solid #eee",
					padding: "10px 12px",
					display: "flex",
					gap: 8,
				}}
			>
				<input
					type="text"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onCompositionStart={() => setIsComposing(true)}
					onCompositionEnd={() => setIsComposing(false)}
					onKeyDown={(e) => {
						e.stopPropagation();
						if (e.key === "Enter" && !isComposing && !isSending) handleSend();
					}}
					placeholder="Type a message..."
					disabled={isSending}
					style={{
						flex: 1,
						border: "1px solid #e5e5e5",
						borderRadius: 8,
						padding: "8px 12px",
						fontSize: 13,
						outline: "none",
						fontFamily: "inherit",
					}}
				/>
				<button
					type="button"
					onClick={handleSend}
					disabled={isSending || !input.trim()}
					style={{
						border: "none",
						background: isSending || !input.trim() ? "#ccc" : "#1e1e1e",
						color: "#fff",
						borderRadius: 8,
						padding: "8px 14px",
						fontSize: 13,
						cursor: isSending || !input.trim() ? "default" : "pointer",
						flexShrink: 0,
					}}
				>
					Send
				</button>
			</div>
		</div>
	);
}
