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
	const controller = new AbortController();

	const response = await fetch(`${apiUrl}/api/ai/complete`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...headers,
		},
		body: JSON.stringify(request),
		credentials: "include",
		signal: controller.signal,
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

	try {
		// iterativeループでストリームを消費
		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				// ストリーム終了時にバッファに残りがあれば処理
				if (buffer.trim()) {
					const result = processChunk("\n\n");
					if (result) return result;
				}
				throw new Error("Stream ended without result");
			}

			const result = processChunk(decoder.decode(value, { stream: true }));
			if (result) return result;
		}
	} finally {
		// ストリームを確実にキャンセル
		reader.cancel().catch(() => {});
		controller.abort();
	}

	function processChunk(chunk: string): AiResponseEvent | null {
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
				const result = handleEvent(currentEvent, currentData);
				currentEvent = "";
				currentData = "";
				if (result !== undefined) return result;
			}
		}
		return null;
	}

	function handleEvent(event: string, data: string): AiResponseEvent | null | undefined {
		const parsed = JSON.parse(data);
		switch (event) {
			case "status":
				onStatus(parsed as AiStatusEvent);
				return undefined;
			case "result":
				onStatus({ status: "done" });
				return parsed as AiResponseEvent;
			case "error":
				onStatus({ status: "error", message: parsed.message });
				throw new Error(parsed.message || "AI error");
		}
		return undefined;
	}
}
