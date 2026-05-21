/**
 * Strip markdown fences and common LLM artifacts that creep into OpenUI Lang
 * output despite an explicit "no markdown" system prompt.
 *
 * The Renderer's parser is forgiving but rejects entire responses on a
 * trailing ``` — easier to clean up at the dispatch boundary than trust the
 * model to behave.
 */
export function sanitizeLangSource(raw: string): string {
	let s = raw.trim();
	// Leading opening fence: ```openui-lang / ```ts / ```
	s = s.replace(/^```[a-zA-Z0-9_-]*\s*\n/, "");
	// Trailing closing fence
	s = s.replace(/\n```\s*$/, "");
	// Some models add "Here is the UI:" or similar — strip a single leading
	// line that does not start with an identifier=Component( pattern.
	// Conservative: only strip if the first non-empty line clearly is prose.
	const lines = s.split("\n");
	if (lines.length > 1 && lines[0] && !/^[a-zA-Z_][\w$]*\s*=/.test(lines[0])) {
		const trimmed = lines[0].trim();
		if (trimmed.endsWith(":") || trimmed.endsWith(".") || trimmed.startsWith("//")) {
			s = lines.slice(1).join("\n").trimStart();
		}
	}
	return s.trim();
}
