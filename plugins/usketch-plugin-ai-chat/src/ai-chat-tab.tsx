import type { AiRequestEvent, AiStatusEvent } from "@edv4h/usketch-plugin-ai-agent";
import type { EventBus } from "@edv4h/usketch-shared";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "./types.js";

interface AiChatTabProps {
	events: EventBus;
	boardId: string;
}

let messageCounter = 0;
function nextId(): string {
	return `chat-${Date.now()}-${++messageCounter}`;
}

export function AiChatTab({ events, boardId }: AiChatTabProps) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [statusText, setStatusText] = useState("");
	const [isComposing, setIsComposing] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const scrollToBottom = useCallback(() => {
		requestAnimationFrame(() => {
			if (scrollRef.current) {
				scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
			}
		});
	}, []);

	// AIステータスイベントをリッスン
	useEffect(() => {
		return events.on<AiStatusEvent>("ai:status", (status) => {
			switch (status.status) {
				case "thinking":
					setIsLoading(true);
					setStatusText("AI is thinking…");
					scrollToBottom();
					break;
				case "placing":
					setStatusText(`Placing ${status.shapeCount ?? 0} shapes…`);
					scrollToBottom();
					break;
				case "done":
					setIsLoading(false);
					setStatusText("");
					setMessages((prev) => [
						...prev,
						{
							id: nextId(),
							role: "assistant",
							text: status.shapeCount
								? `Done — placed ${status.shapeCount} shapes on the canvas.`
								: "Done!",
							createdAt: new Date().toISOString(),
						},
					]);
					scrollToBottom();
					break;
				case "error":
					setIsLoading(false);
					setStatusText("");
					setMessages((prev) => [
						...prev,
						{
							id: nextId(),
							role: "assistant",
							text: `Error: ${status.message ?? "Something went wrong"}`,
							createdAt: new Date().toISOString(),
						},
					]);
					scrollToBottom();
					break;
			}
		});
	}, [events, scrollToBottom]);

	const handleSend = useCallback(() => {
		const text = input.trim();
		if (!text || isLoading) return;

		setMessages((prev) => [
			...prev,
			{
				id: nextId(),
				role: "user",
				text,
				createdAt: new Date().toISOString(),
			},
		]);
		setInput("");
		scrollToBottom();

		events.emit<AiRequestEvent>("ai:request", { prompt: text, boardId });
	}, [input, isLoading, events, boardId, scrollToBottom]);

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 300 }}>
			{/* メッセージ一覧 */}
			<div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
				{messages.length === 0 && !isLoading && (
					<div style={{ textAlign: "center", color: "#999", fontSize: 13, padding: "24px 0" }}>
						Ask AI to draw, modify, or organize shapes on the canvas.
					</div>
				)}
				{messages.map((msg) => (
					<div
						key={msg.id}
						style={{
							marginBottom: 12,
							display: "flex",
							flexDirection: "column",
							alignItems: msg.role === "user" ? "flex-end" : "flex-start",
						}}
					>
						<div
							style={{
								maxWidth: "85%",
								padding: "8px 12px",
								borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
								background: msg.role === "user" ? "#1e1e1e" : "#f0f0f0",
								color: msg.role === "user" ? "#fff" : "#333",
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
				))}
				{isLoading && statusText && (
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 8,
							padding: "8px 0",
							fontSize: 13,
							color: "#666",
						}}
					>
						<div
							style={{
								width: 14,
								height: 14,
								border: "2px solid #ddd",
								borderTopColor: "#666",
								borderRadius: "50%",
								animation: "ai-chat-spin 0.6s linear infinite",
								flexShrink: 0,
							}}
						/>
						{statusText}
					</div>
				)}
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
					ref={inputRef}
					type="text"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onCompositionStart={() => setIsComposing(true)}
					onCompositionEnd={() => setIsComposing(false)}
					onKeyDown={(e) => {
						e.stopPropagation();
						if (e.key === "Enter" && !isComposing && !isLoading) handleSend();
					}}
					placeholder="Ask AI…"
					disabled={isLoading}
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
					disabled={isLoading || !input.trim()}
					style={{
						border: "none",
						background: isLoading || !input.trim() ? "#ccc" : "#1e1e1e",
						color: "#fff",
						borderRadius: 8,
						padding: "8px 14px",
						fontSize: 13,
						cursor: isLoading || !input.trim() ? "default" : "pointer",
						flexShrink: 0,
					}}
				>
					Send
				</button>
			</div>

			{/* スピナーアニメーション用CSS */}
			<style>{`@keyframes ai-chat-spin { to { transform: rotate(360deg); } }`}</style>
		</div>
	);
}
