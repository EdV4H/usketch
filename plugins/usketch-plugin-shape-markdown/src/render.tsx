import type { ShapeData } from "@edv4h/usketch-shared";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Markdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { markdownSelection } from "./selection-store.js";
import { readMarkdownMeta } from "./types.js";

// ── Custom events (plugin.tsx listens on window) ──
export const MD_INPUT_EVENT = "usketch:markdown-input";
export const MD_BLUR_EVENT = "usketch:markdown-blur";
export const MD_ESCAPE_EVENT = "usketch:markdown-escape";
export const MD_MEASURE_EVENT = "usketch:markdown-measure";

const STYLE_ID = "usketch-markdown-styles";

/** Inject scoped markdown + highlight.js theme CSS once per document. */
function ensureStyles(): void {
	if (typeof document === "undefined") return;
	if (document.getElementById(STYLE_ID)) return;
	const el = document.createElement("style");
	el.id = STYLE_ID;
	el.textContent = MARKDOWN_CSS;
	document.head.appendChild(el);
}

function isDarkTheme(): boolean {
	if (typeof document === "undefined") return false;
	const attr = document.documentElement.getAttribute("data-theme");
	if (attr === "dark") return true;
	if (attr === "light") return false;
	return (
		typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
	);
}

// ── Mermaid block (dynamic import; renders SVG into a ref container) ──

function MermaidBlock({ code }: { code: string }) {
	const ref = useRef<HTMLDivElement>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				// Dynamic import keeps the (large) mermaid bundle out of the main chunk.
				const mermaid = (await import("mermaid")).default;
				mermaid.initialize({
					startOnLoad: false,
					// strict: mermaid sanitizes labels, disables inline HTML & click handlers.
					securityLevel: "strict",
					theme: isDarkTheme() ? "dark" : "default",
				});
				const id = `usketch-mermaid-${Math.random().toString(36).slice(2)}`;
				const { svg } = await mermaid.render(id, code);
				if (cancelled || !ref.current) return;
				// Parse the SVG string and adopt the <svg> node rather than assigning
				// `innerHTML` — avoids a string-HTML sink (CSP / Trusted Types friendly).
				const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
				const svgEl = parsed.querySelector("svg");
				if (!svgEl) throw new Error("Mermaid produced no <svg>");
				ref.current.replaceChildren(document.importNode(svgEl, true));
				setError(null);
			} catch (e) {
				if (!cancelled) setError(e instanceof Error ? e.message : "Mermaid render error");
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [code]);

	if (error) {
		return (
			<pre className="usketch-md-mermaid-error" title={error}>
				{`⚠ mermaid: ${error}\n\n${code}`}
			</pre>
		);
	}
	return <div ref={ref} className="usketch-md-mermaid" role="img" aria-label="mermaid diagram" />;
}

// ── Rendered (view) mode ──

const mdComponents: Components = {
	code({ className, children }) {
		const lang = /language-(\w+)/.exec(className ?? "")?.[1];
		if (lang === "mermaid") {
			return <MermaidBlock code={String(children).replace(/\n$/, "")} />;
		}
		// rehype-highlight has already injected token <span>s into children.
		return <code className={className}>{children}</code>;
	},
	// Links open in a new tab; never let a markdown link navigate the whole app.
	a({ href, children }) {
		return (
			<a href={href} target="_blank" rel="noopener noreferrer">
				{children}
			</a>
		);
	},
};

function MarkdownView({ shape }: { shape: ShapeData }) {
	const { source } = readMarkdownMeta(shape);
	const ref = useRef<HTMLDivElement>(null);
	// Content is interactive (links, text selection) only while the shape is
	// selected; unselected shapes stay non-interactive so a click/drag on the
	// canvas selects & moves the shape.
	const selected = useSyncExternalStore(markdownSelection.subscribe, () =>
		markdownSelection.has(shape.id),
	);

	useEffect(() => {
		ensureStyles();
	}, []);

	// Auto-fit the shape height to the rendered content (GFM tables, mermaid
	// diagrams etc. are usually taller than the raw source). Mermaid renders
	// asynchronously, so a ResizeObserver catches the late height change.
	useEffect(() => {
		const el = ref.current;
		if (!el || typeof ResizeObserver === "undefined") return;
		const ro = new ResizeObserver(() => {
			window.dispatchEvent(
				new CustomEvent(MD_MEASURE_EVENT, {
					detail: { id: shape.id, height: el.scrollHeight },
				}),
			);
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, [shape.id]);

	return (
		<div
			className="usketch-md"
			ref={ref}
			// When selected: links are clickable and Alt+drag selects text (stop
			// propagation so the canvas doesn't move the shape); a plain drag moves
			// the shape (bubbles to the select tool). When unselected the content is
			// pass-through (pointerEvents:none) so the canvas handles select/move —
			// i.e. links are only clickable while the shape is selected.
			onPointerDown={
				selected
					? (e) => {
							if (e.altKey) {
								e.currentTarget.style.userSelect = "text";
								e.stopPropagation();
							} else {
								e.currentTarget.style.userSelect = "none";
							}
						}
					: undefined
			}
			// Reset the imperative userSelect after an Alt+drag so it doesn't linger
			// into the next (plain) drag before a re-render clears it.
			onPointerUp={selected ? (e) => (e.currentTarget.style.userSelect = "none") : undefined}
			onPointerCancel={selected ? (e) => (e.currentTarget.style.userSelect = "none") : undefined}
			style={{
				width: "100%",
				boxSizing: "border-box",
				padding: 8,
				overflow: "hidden",
				// Selected → interactive content (links clickable, Alt+drag text select).
				// Unselected → transparent to pointers so the canvas handles select/move.
				pointerEvents: selected ? "auto" : "none",
				userSelect: "none",
				color: shape.style.stroke,
				background: shape.style.fill === "transparent" ? "transparent" : shape.style.fill,
			}}
		>
			{source.trim() === "" ? (
				<span className="usketch-md-empty">（空の Markdown — HUD の Edit source で編集）</span>
			) : (
				<Markdown
					remarkPlugins={[remarkGfm]}
					// ignoreMissing: unsupported languages (incl. our ```mermaid``` blocks,
					// which highlight.js doesn't know) fall back to plain code instead of
					// throwing and breaking the whole render.
					rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
					components={mdComponents}
				>
					{source}
				</Markdown>
			)}
		</div>
	);
}

// ── Editor (raw markdown) mode ──

function MarkdownEditor({ shape }: { shape: ShapeData }) {
	const { source } = readMarkdownMeta(shape);
	const ref = useRef<HTMLTextAreaElement>(null);

	// Focus + place cursor at end once when entering edit mode. The textarea's
	// own value is uncontrolled after mount so the caret isn't reset on input.
	// biome-ignore lint/correctness/useExhaustiveDependencies: init once per mount (textarea is uncontrolled afterwards)
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.value = source;
		autoGrow(el);
		requestAnimationFrame(() => {
			el.focus();
			el.setSelectionRange(el.value.length, el.value.length);
		});
	}, []);

	const emitInput = (el: HTMLTextAreaElement) => {
		autoGrow(el);
		window.dispatchEvent(
			new CustomEvent(MD_INPUT_EVENT, {
				detail: { id: shape.id, source: el.value, scrollHeight: el.scrollHeight },
			}),
		);
	};

	return (
		<textarea
			ref={ref}
			data-usketch-md-editor="1"
			defaultValue={source}
			spellCheck={false}
			onInput={(e) => {
				if ((e.nativeEvent as InputEvent).isComposing) return;
				emitInput(e.currentTarget);
			}}
			onCompositionEnd={(e) => emitInput(e.currentTarget)}
			onKeyDown={(e) => {
				e.stopPropagation();
				if (e.key === "Escape" && !e.nativeEvent.isComposing) {
					window.dispatchEvent(new CustomEvent(MD_ESCAPE_EVENT, { detail: { id: shape.id } }));
				}
			}}
			onBlur={() => {
				window.dispatchEvent(new CustomEvent(MD_BLUR_EVENT, { detail: { id: shape.id } }));
			}}
			onPointerDown={(e) => e.stopPropagation()}
			style={{
				width: "100%",
				height: "100%",
				boxSizing: "border-box",
				padding: 8,
				border: "none",
				outline: "none",
				resize: "none",
				background: "var(--bg-input, #1e1e1e)",
				color: "var(--fg-primary, #eee)",
				fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
				fontSize: 13,
				lineHeight: 1.5,
				cursor: "text",
				pointerEvents: "auto",
				userSelect: "auto",
			}}
		/>
	);
}

function autoGrow(el: HTMLTextAreaElement): void {
	el.style.height = "auto";
	el.style.height = `${el.scrollHeight}px`;
}

// ── Entry point + LOD ──

export function renderMarkdown(shape: ShapeData) {
	return readMarkdownMeta(shape).isEditing ? (
		<MarkdownEditor shape={shape} />
	) : (
		<MarkdownView shape={shape} />
	);
}

/** LOD: first non-empty line, stripped of common markdown markers. */
export function SimplifiedMarkdown({ shape }: { shape: ShapeData }) {
	const { source } = readMarkdownMeta(shape);
	const firstLine =
		source
			.split("\n")
			.map((l) => l.trim())
			.find((l) => l.length > 0) ?? "";
	const plain = firstLine.replace(/^#{1,6}\s+/, "").replace(/[*_`>#-]/g, "");
	return (
		<div
			style={{
				position: "absolute",
				left: shape.x,
				top: shape.y,
				width: shape.width,
				height: shape.height,
				padding: 8,
				boxSizing: "border-box",
				fontFamily: "system-ui, sans-serif",
				fontSize: 14,
				fontWeight: 600,
				color: shape.style.stroke || "#222",
				overflow: "hidden",
				whiteSpace: "nowrap",
				textOverflow: "ellipsis",
				pointerEvents: "none",
			}}
		>
			{plain || "Markdown"}
		</div>
	);
}

// ── Scoped CSS (markdown layout + compact highlight.js github theme) ──

const MARKDOWN_CSS = `
.usketch-md { font-family: system-ui, -apple-system, sans-serif; font-size: 13px; line-height: 1.55; word-break: break-word; }
.usketch-md > :first-child { margin-top: 0; }
.usketch-md > :last-child { margin-bottom: 0; }
.usketch-md h1, .usketch-md h2, .usketch-md h3 { margin: 0.4em 0 0.3em; line-height: 1.25; font-weight: 700; }
.usketch-md h1 { font-size: 1.6em; } .usketch-md h2 { font-size: 1.35em; } .usketch-md h3 { font-size: 1.15em; }
.usketch-md p { margin: 0.4em 0; }
.usketch-md ul, .usketch-md ol { margin: 0.3em 0; padding-left: 1.4em; }
.usketch-md li { margin: 0.1em 0; }
.usketch-md a { color: #2563eb; text-decoration: underline; }
.usketch-md blockquote { margin: 0.4em 0; padding: 0 0.8em; border-left: 3px solid currentColor; opacity: 0.75; }
.usketch-md table { border-collapse: collapse; margin: 0.4em 0; font-size: 0.95em; }
.usketch-md th, .usketch-md td { border: 1px solid rgba(128,128,128,0.4); padding: 3px 8px; }
.usketch-md th { background: rgba(128,128,128,0.15); font-weight: 600; }
.usketch-md code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; background: rgba(128,128,128,0.15); padding: 1px 4px; border-radius: 3px; }
.usketch-md pre { margin: 0.4em 0; padding: 8px 10px; border-radius: 6px; overflow-x: auto; background: #f6f8fa; }
.usketch-md pre code { background: none; padding: 0; }
.usketch-md input[type="checkbox"] { margin-right: 6px; }
.usketch-md-empty { opacity: 0.5; font-style: italic; }
.usketch-md-mermaid { display: flex; justify-content: center; margin: 0.4em 0; }
.usketch-md-mermaid svg { max-width: 100%; height: auto; }
.usketch-md-mermaid-error { color: #dc2626; font-size: 0.85em; white-space: pre-wrap; }
/* highlight.js (github light) */
.usketch-md .hljs { color: #24292e; }
.usketch-md .hljs-comment, .usketch-md .hljs-quote { color: #6a737d; }
.usketch-md .hljs-keyword, .usketch-md .hljs-selector-tag, .usketch-md .hljs-literal, .usketch-md .hljs-type { color: #d73a49; }
.usketch-md .hljs-string, .usketch-md .hljs-attr, .usketch-md .hljs-regexp, .usketch-md .hljs-addition { color: #032f62; }
.usketch-md .hljs-number, .usketch-md .hljs-built_in, .usketch-md .hljs-symbol, .usketch-md .hljs-title { color: #005cc5; }
.usketch-md .hljs-name, .usketch-md .hljs-section, .usketch-md .hljs-attribute { color: #22863a; }
.usketch-md .hljs-variable, .usketch-md .hljs-template-variable, .usketch-md .hljs-deletion { color: #b31d28; }
:root[data-theme="dark"] .usketch-md pre { background: #161b22; }
:root[data-theme="dark"] .usketch-md .hljs { color: #c9d1d9; }
:root[data-theme="dark"] .usketch-md .hljs-comment, :root[data-theme="dark"] .usketch-md .hljs-quote { color: #8b949e; }
:root[data-theme="dark"] .usketch-md .hljs-keyword, :root[data-theme="dark"] .usketch-md .hljs-literal, :root[data-theme="dark"] .usketch-md .hljs-type { color: #ff7b72; }
:root[data-theme="dark"] .usketch-md .hljs-string, :root[data-theme="dark"] .usketch-md .hljs-attr { color: #a5d6ff; }
:root[data-theme="dark"] .usketch-md .hljs-number, :root[data-theme="dark"] .usketch-md .hljs-built_in, :root[data-theme="dark"] .usketch-md .hljs-title { color: #79c0ff; }
:root[data-theme="dark"] .usketch-md .hljs-name, :root[data-theme="dark"] .usketch-md .hljs-section { color: #7ee787; }
`;
