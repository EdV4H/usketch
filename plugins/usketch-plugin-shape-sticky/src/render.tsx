import type { ShapeData } from "@edv4h/usketch-shared";
import { DEFAULT_STICKY_COLOR, STICKY_COLORS } from "./constants.js";

function getStickyBackground(data: ShapeData): string {
	const colorKey = (data.stickyColor as string) ?? DEFAULT_STICKY_COLOR;
	if (data.style.fill !== "transparent" && data.style.fill !== STICKY_COLORS[colorKey]) {
		return data.style.fill;
	}
	return STICKY_COLORS[colorKey] ?? STICKY_COLORS[DEFAULT_STICKY_COLOR];
}

const baseStickyStyle = (data: ShapeData): React.CSSProperties => ({
	width: "100%",
	background: getStickyBackground(data),
	borderRadius: 8,
	boxShadow: "2px 3px 8px rgba(0,0,0,0.12)",
	padding: 12,
	boxSizing: "border-box",
	fontFamily: "system-ui, sans-serif",
	fontSize: (data.fontSize as number) ?? 16,
	color: "#1e1e1e",
	lineHeight: 1.4,
	whiteSpace: "pre-wrap",
	wordBreak: "break-word",
	outline: "none",
});

function focusAtEnd(el: HTMLElement) {
	el.focus();
	const sel = window.getSelection();
	if (sel) {
		const range = document.createRange();
		range.selectNodeContents(el);
		range.collapse(false);
		sel.removeAllRanges();
		sel.addRange(range);
	}
}

export function render(data: ShapeData) {
	if (!data.isEditing) {
		return (
			<div
				style={{
					...baseStickyStyle(data),
					height: "100%",
					overflow: "hidden",
					pointerEvents: "none",
					userSelect: "none",
				}}
			>
				{(data.text as string) ?? ""}
			</div>
		);
	}

	return (
		// biome-ignore lint/a11y/useSemanticElements: contentEditable div is standard for rich text editing
		<div
			contentEditable="plaintext-only"
			suppressContentEditableWarning
			role="textbox"
			aria-multiline="true"
			tabIndex={0}
			ref={(el: HTMLDivElement | null) => {
				if (!el) return;
				if (el.dataset.focused) return;
				el.dataset.focused = "1";
				el.textContent = (data.text as string) ?? "";
				requestAnimationFrame(() => focusAtEnd(el));
			}}
			onInput={(e: React.FormEvent<HTMLDivElement>) => {
				if ((e.nativeEvent as InputEvent).isComposing) return;
				const el = e.currentTarget;
				window.dispatchEvent(
					new CustomEvent("usketch:text-input", {
						detail: { id: data.id, text: el.innerText, scrollHeight: el.scrollHeight },
					}),
				);
			}}
			onCompositionEnd={(e: React.CompositionEvent<HTMLDivElement>) => {
				const el = e.currentTarget;
				window.dispatchEvent(
					new CustomEvent("usketch:text-input", {
						detail: { id: data.id, text: el.innerText, scrollHeight: el.scrollHeight },
					}),
				);
			}}
			onKeyDown={(e: React.KeyboardEvent) => {
				e.stopPropagation();
				if (e.key === "Escape" && !e.nativeEvent.isComposing) {
					window.dispatchEvent(new CustomEvent("usketch:text-escape", { detail: { id: data.id } }));
				}
			}}
			onBlur={(e: React.FocusEvent<HTMLDivElement>) => {
				delete e.currentTarget.dataset.focused;
				window.dispatchEvent(new CustomEvent("usketch:text-blur", { detail: { id: data.id } }));
			}}
			onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
			style={{
				...baseStickyStyle(data),
				height: "100%",
				overflow: "auto",
				cursor: "text",
				pointerEvents: "auto",
				userSelect: "auto",
			}}
		/>
	);
}
