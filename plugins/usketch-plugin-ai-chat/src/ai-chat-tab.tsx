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
					setStatusText("AI が考えています…");
					scrollToBottom();
					break;
				case "placing":
					setStatusText(`${status.shapeCount ?? 0} 個のシェイプを配置中…`);
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
								? `完了 — ${status.shapeCount} 個のシェイプを配置しました。`
								: "完了しました。",
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
							text: `エラー: ${status.message ?? "予期しない問題が発生しました"}`,
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
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				height: "100%",
				minHeight: 300,
				color: "var(--fg-primary)",
			}}
		>
			{/* メッセージ一覧 */}
			<div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
				{messages.length === 0 && !isLoading && (
					<div
						style={{
							textAlign: "center",
							color: "var(--fg-tertiary)",
							fontSize: 13,
							padding: "24px 0",
						}}
					>
						AI にキャンバス上のシェイプの作成・編集・整列を依頼できます。
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
								background: msg.role === "user" ? "var(--brand-gradient)" : "var(--bg-input)",
								color: msg.role === "user" ? "white" : "var(--fg-primary)",
								fontSize: 13,
								lineHeight: 1.5,
								wordBreak: "break-word",
							}}
						>
							{msg.text}
						</div>
						<div
							style={{
								fontSize: 10,
								color: "var(--fg-tertiary)",
								marginTop: 2,
								padding: "0 4px",
							}}
						>
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
							color: "var(--fg-secondary)",
						}}
					>
						<div
							style={{
								width: 14,
								height: 14,
								border: "2px solid var(--border-default)",
								borderTopColor: "var(--brand-violet)",
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
					borderTop: "1px solid var(--border-subtle)",
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
					placeholder="AI に依頼…"
					disabled={isLoading}
					style={{
						flex: 1,
						border: "1px solid var(--border-default)",
						background: "var(--bg-input)",
						color: "var(--fg-primary)",
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
						background: isLoading || !input.trim() ? "var(--bg-input)" : "var(--brand-gradient)",
						color: isLoading || !input.trim() ? "var(--fg-tertiary)" : "white",
						borderRadius: 8,
						padding: "8px 14px",
						fontSize: 13,
						fontWeight: 500,
						cursor: isLoading || !input.trim() ? "default" : "pointer",
						flexShrink: 0,
						fontFamily: "inherit",
					}}
				>
					送信
				</button>
			</div>

			{/* スピナーアニメーション用CSS */}
			<style>{`@keyframes ai-chat-spin { to { transform: rotate(360deg); } }`}</style>
		</div>
	);
}
