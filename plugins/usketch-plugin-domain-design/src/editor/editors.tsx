import type { ShapeStyle } from "@edv4h/usketch-shared";
import type { ClassBoxMeta, ClassStereotype } from "../types.js";

const STEREOTYPES: ClassStereotype[] = [
	"Entity",
	"ValueObject",
	"Service",
	"Repository",
	"DomainEvent",
	"Factory",
];

function focusAtEnd(el: HTMLElement) {
	el.focus();
	const sel = window.getSelection();
	if (!sel) return;
	const range = document.createRange();
	range.selectNodeContents(el);
	range.collapse(false);
	sel.removeAllRanges();
	sel.addRange(range);
}

function dispatchCommit(id: string, nextMeta: Record<string, unknown>) {
	window.dispatchEvent(
		new CustomEvent("usketch:domain-design:commit", { detail: { id, nextMeta } }),
	);
}

function dispatchCancel(id: string) {
	window.dispatchEvent(new CustomEvent("usketch:domain-design:cancel", { detail: { id } }));
}

interface TitleEditorProps {
	shapeId: string;
	initial: string;
	field?: string;
}

/**
 * 1 行タイトル編集（BoundedContext.contextName / Aggregate.rootName 用）。
 * `field` で meta のどのキーに書き戻すか指定する（デフォルト: contextName）。
 */
export function TitleEditor({ shapeId, initial, field = "contextName" }: TitleEditorProps) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: contentEditable は inline-edit の慣用
		<span
			contentEditable="plaintext-only"
			suppressContentEditableWarning
			role="textbox"
			tabIndex={0}
			ref={(el: HTMLSpanElement | null) => {
				if (!el || el.dataset.focused) return;
				el.dataset.focused = "1";
				el.textContent = initial;
				requestAnimationFrame(() => focusAtEnd(el));
			}}
			onPointerDown={(e) => e.stopPropagation()}
			onKeyDown={(e) => {
				e.stopPropagation();
				if (e.key === "Enter" && !e.nativeEvent.isComposing) {
					e.preventDefault();
					(e.currentTarget as HTMLElement).blur();
				}
				if (e.key === "Escape" && !e.nativeEvent.isComposing) {
					dispatchCancel(shapeId);
				}
			}}
			onBlur={(e) => {
				delete e.currentTarget.dataset.focused;
				const text = e.currentTarget.innerText.trim();
				dispatchCommit(shapeId, { [field]: text });
			}}
			style={{
				fontSize: 16,
				fontWeight: 600,
				color: "#1e1e1e",
				outline: "none",
				cursor: "text",
				userSelect: "auto",
				background: "rgba(59,130,246,0.08)",
				borderRadius: 3,
				padding: "0 4px",
				flex: 1,
				minWidth: 40,
			}}
		/>
	);
}

interface ClassBoxEditorProps {
	shapeId: string;
	meta: ClassBoxMeta;
	accent: string;
	style: ShapeStyle;
}

/**
 * ClassBox の 3 セクション編集。クラス名 / 属性（複数行） / メソッド（複数行）。
 * blur で1 つに集約してから commit する（セクション単位ではなく shape 単位の COMMIT）。
 */
export function ClassBoxEditor({ shapeId, meta, accent, style }: ClassBoxEditorProps) {
	const initialName = meta.className ?? "";
	const initialAttrs = (meta.attributes ?? []).join("\n");
	const initialMethods = (meta.methods ?? []).join("\n");

	function readAndCommit(rootEl: HTMLElement) {
		const nameEl = rootEl.querySelector<HTMLElement>("[data-domain-field=name]");
		const attrEl = rootEl.querySelector<HTMLElement>("[data-domain-field=attributes]");
		const methodEl = rootEl.querySelector<HTMLElement>("[data-domain-field=methods]");
		const stereotypeEl = rootEl.querySelector<HTMLSelectElement>("[data-domain-field=stereotype]");
		const className = (nameEl?.innerText ?? "").trim();
		const attributes = (attrEl?.innerText ?? "")
			.split("\n")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
		const methods = (methodEl?.innerText ?? "")
			.split("\n")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
		const stereotype = (stereotypeEl?.value ?? meta.stereotype) as ClassStereotype;

		dispatchCommit(shapeId, {
			className,
			stereotype,
			attributes,
			methods,
		});
	}

	let rootRef: HTMLDivElement | null = null;

	function handleBlur(e: React.FocusEvent<HTMLDivElement>) {
		// セクション間のフォーカス移動は内側に留まるので無視
		const next = e.relatedTarget as Node | null;
		if (next && rootRef?.contains(next)) return;
		if (rootRef) readAndCommit(rootRef);
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		e.stopPropagation();
		if (e.key === "Escape" && !e.nativeEvent.isComposing) {
			dispatchCancel(shapeId);
		}
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: editor wrapper の handler は内側の contenteditable / select に対する非バブリング処理用。インタラクティブ要素は子要素側にある
		<div
			ref={(el) => {
				rootRef = el;
			}}
			onPointerDown={(e) => e.stopPropagation()}
			onBlur={handleBlur}
			onKeyDown={handleKeyDown}
			style={{
				width: "100%",
				height: "100%",
				background: style.fill,
				border: `${style.strokeWidth}px solid ${style.stroke}`,
				boxSizing: "border-box",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				opacity: style.opacity,
				fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
			}}
		>
			<div
				style={{
					padding: "6px 8px",
					borderBottom: `1px solid ${style.stroke}`,
					textAlign: "center",
					background: `${accent}10`,
				}}
			>
				<select
					data-domain-field="stereotype"
					defaultValue={meta.stereotype}
					onPointerDown={(e) => e.stopPropagation()}
					style={{
						fontSize: 10,
						color: accent,
						fontWeight: 500,
						border: "none",
						background: "transparent",
						cursor: "pointer",
					}}
				>
					{STEREOTYPES.map((s) => (
						<option key={s} value={s}>
							«{s}»
						</option>
					))}
				</select>
				<div
					data-domain-field="name"
					contentEditable="plaintext-only"
					suppressContentEditableWarning
					ref={(el: HTMLDivElement | null) => {
						if (!el || el.dataset.focused) return;
						el.dataset.focused = "1";
						el.textContent = initialName;
						requestAnimationFrame(() => focusAtEnd(el));
					}}
					style={{
						fontSize: 14,
						fontWeight: 600,
						color: "#1e1e1e",
						outline: "none",
						cursor: "text",
						userSelect: "auto",
					}}
				/>
			</div>
			<div
				data-domain-field="attributes"
				contentEditable="plaintext-only"
				suppressContentEditableWarning
				ref={(el: HTMLDivElement | null) => {
					if (!el || el.dataset.focused) return;
					el.dataset.focused = "1";
					el.textContent = initialAttrs;
				}}
				style={{
					padding: "4px 8px",
					borderBottom: `1px solid ${style.stroke}`,
					fontSize: 11,
					color: "#1e1e1e",
					flex: 1,
					overflow: "auto",
					whiteSpace: "pre-wrap",
					outline: "none",
					cursor: "text",
					userSelect: "auto",
				}}
			/>
			<div
				data-domain-field="methods"
				contentEditable="plaintext-only"
				suppressContentEditableWarning
				ref={(el: HTMLDivElement | null) => {
					if (!el || el.dataset.focused) return;
					el.dataset.focused = "1";
					el.textContent = initialMethods;
				}}
				style={{
					padding: "4px 8px",
					fontSize: 11,
					color: "#1e1e1e",
					flex: 1,
					overflow: "auto",
					whiteSpace: "pre-wrap",
					outline: "none",
					cursor: "text",
					userSelect: "auto",
				}}
			/>
		</div>
	);
}
