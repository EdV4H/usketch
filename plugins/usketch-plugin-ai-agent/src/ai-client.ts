import type { AiCompleteRequest, AiResponseEvent, AiStatusEvent } from "./types.js";

/**
 * サーバーのAI完了エンドポイントにリクエストを送り、SSEストリームを消費する。
 */
export async function requestAiCompletion(
	apiUrl: string,
	request: AiCompleteRequest,
	onStatus: (status: AiStatusEvent) => void,
	headers?: Record<string, string>,
): Promise<AiResponseEvent> {
	const response = await fetch(`${apiUrl}/api/ai/complete`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...headers,
		},
		body: JSON.stringify(request),
		credentials: "include",
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`AI request failed: ${response.status} ${text}`);
	}

	const body = response.body;
	if (!body) {
		throw new Error("No response body");
	}
	const reader = body.getReader();

	const decoder = new TextDecoder();
	let buffer = "";
	// チャンク境界を跨いでも状態を保持
	let currentEvent = "";
	let currentData = "";

	return new Promise<AiResponseEvent>((resolve, reject) => {
		function processChunk(chunk: string): void {
			buffer += chunk;
			const lines = buffer.split("\n");
			// 最後の行は不完全な可能性があるのでバッファに残す
			buffer = lines.pop() ?? "";

			for (const line of lines) {
				if (line.startsWith("event: ")) {
					currentEvent = line.slice(7).trim();
				} else if (line.startsWith("data: ")) {
					currentData = line.slice(6).trim();
				} else if (line === "" && currentEvent && currentData) {
					// 空行でイベント完了
					handleEvent(currentEvent, currentData);
					currentEvent = "";
					currentData = "";
				}
			}
		}

		function handleEvent(event: string, data: string): void {
			try {
				const parsed = JSON.parse(data);
				switch (event) {
					case "status":
						onStatus(parsed as AiStatusEvent);
						break;
					case "result":
						onStatus({ status: "done" });
						resolve(parsed as AiResponseEvent);
						break;
					case "error":
						onStatus({ status: "error", message: parsed.message });
						reject(new Error(parsed.message || "AI error"));
						break;
				}
			} catch {
				// JSONパース失敗は無視
			}
		}

		async function read(): Promise<void> {
			try {
				const { done, value } = await reader.read();
				if (done) {
					// ストリーム終了時にバッファに残りがあれば処理
					if (buffer.trim()) {
						processChunk("\n\n");
					}
					return;
				}
				processChunk(decoder.decode(value, { stream: true }));
				await read();
			} catch (err) {
				reject(err instanceof Error ? err : new Error("Stream read error"));
			}
		}

		read();
	});
}
