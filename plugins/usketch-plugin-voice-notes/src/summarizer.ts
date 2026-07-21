/**
 * Turn a raw transcript into a structured summary diagram via the server's
 * OpenAI-compatible proxy (`/api/ai/openui`), so the OpenAI key stays server-side.
 */

export interface SummaryPoint {
	label: string;
	detail?: string;
}

export interface VoiceSummary {
	title: string;
	points: SummaryPoint[];
	/** Related point pairs by index into `points` (directional). */
	links: [number, number][];
}

const SYSTEM_PROMPT = `あなたは会議の書記です。与えられた文字起こしを、ホワイトボードに描く「まとめの図」用の構造化データに変換します。
必ず次の JSON だけを出力してください（前後の説明・コードフェンス禁止）:
{"title": string, "points": [{"label": string, "detail"?: string}], "links": [[number, number]]}
- title: 全体の主題（20文字以内目安）
- points: 要点ノード（3〜8個）。label は短く（15文字以内目安）、detail は補足（任意, 40文字以内目安）
- links: 関連する要点の index ペア（[from, to]）。因果・順序・従属を表す。無ければ []`;

/**
 * Best-effort parse of the model's reply into a {@link VoiceSummary}. Tolerates
 * surrounding prose / ```json fences / trailing text; returns null if no valid
 * shape can be recovered.
 */
export function parseSummary(raw: string): VoiceSummary | null {
	if (!raw) return null;
	// Strip code fences, then grab the first {...} block.
	const unfenced = raw.replace(/```(?:json)?/gi, "").trim();
	const start = unfenced.indexOf("{");
	const end = unfenced.lastIndexOf("}");
	if (start === -1 || end === -1 || end <= start) return null;
	let obj: unknown;
	try {
		obj = JSON.parse(unfenced.slice(start, end + 1));
	} catch {
		return null;
	}
	if (typeof obj !== "object" || obj === null) return null;
	const o = obj as Record<string, unknown>;
	const rawPoints = Array.isArray(o.points) ? o.points : [];
	const points: SummaryPoint[] = rawPoints
		.map((p) => {
			const pr = (p ?? {}) as Record<string, unknown>;
			const label = typeof pr.label === "string" ? pr.label.trim() : "";
			const detail = typeof pr.detail === "string" ? pr.detail.trim() : undefined;
			return label ? { label, ...(detail ? { detail } : {}) } : null;
		})
		.filter((p): p is SummaryPoint => p !== null);
	if (points.length === 0) return null;

	const rawLinks = Array.isArray(o.links) ? o.links : [];
	const links: [number, number][] = rawLinks
		.map((l) => (Array.isArray(l) ? [Number(l[0]), Number(l[1])] : null))
		.filter(
			(l): l is [number, number] =>
				l !== null &&
				Number.isInteger(l[0]) &&
				Number.isInteger(l[1]) &&
				l[0] >= 0 &&
				l[1] >= 0 &&
				l[0] < points.length &&
				l[1] < points.length &&
				l[0] !== l[1],
		);

	const title = typeof o.title === "string" && o.title.trim() ? o.title.trim() : "まとめ";
	return { title, points, links };
}

export interface SummarizeOptions {
	boardId?: string;
	headers?: Record<string, string>;
	model?: string;
	/** Injectable fetch for tests. */
	fetchImpl?: typeof fetch;
}

/** Call the server proxy once (non-streaming) and parse the reply. */
export async function summarizeToDiagram(
	apiUrl: string,
	transcript: string,
	opts: SummarizeOptions = {},
): Promise<VoiceSummary | null> {
	const doFetch = opts.fetchImpl ?? fetch;
	const base = apiUrl.replace(/\/+$/, "");
	const url = new URL(`${base}/api/ai/openui`);
	if (opts.boardId) url.searchParams.set("boardId", opts.boardId);

	let res: Response;
	try {
		res = await doFetch(url.toString(), {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
			body: JSON.stringify({
				model: opts.model ?? "gpt-4o",
				stream: false,
				temperature: 0.2,
				messages: [
					{ role: "system", content: SYSTEM_PROMPT },
					{ role: "user", content: transcript.slice(0, 40_000) },
				],
			}),
		});
	} catch {
		return null;
	}
	if (!res.ok) return null;

	// Non-streaming OpenAI chat completion → choices[0].message.content.
	let content = "";
	try {
		const body = (await res.json()) as {
			choices?: { message?: { content?: unknown } }[];
		};
		const c = body.choices?.[0]?.message?.content;
		content = typeof c === "string" ? c : "";
	} catch {
		return null;
	}
	return parseSummary(content);
}
