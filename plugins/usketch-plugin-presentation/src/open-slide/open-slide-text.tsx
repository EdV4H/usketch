import { createContext, type ReactNode, useContext, useRef } from "react";
import { openSlideTextKey } from "./types.js";

/** デッキ Shape が描くページに流す、文字の差し替えと編集の状態。 */
export interface OpenSlideTextContextValue {
	/** 描いているページ (0 始まり)。 */
	page: number;
	/** デッキ Shape の文字の差し替え ({@link OpenSlideOverrides.text})。 */
	text: Record<string, string> | undefined;
	/** このデッキの中身を編集中か。 */
	editing: boolean;
	/** 編集を確定する。`value` が初期値と同じなら差し替えを消す。 */
	commit: (params: { page: number; id: string; value: string; defaultValue: string }) => void;
}

export const OpenSlideTextContext = createContext<OpenSlideTextContextValue | null>(null);

export interface OpenSlideTextProps {
	/** ページ内で一意な id。差し替えはこの id で保存されるので、公開後は変えないこと。 */
	id: string;
	/** 初期値。差し替えがなければこの文字を出す。 */
	children: string;
}

/**
 * ボード上で書き換えられる文字。デッキのページで、編集を許す文字をこれで囲む。
 * ボードの外 (open-slide 本体など) では `children` をそのまま出す。
 *
 * ```tsx
 * <h1><OpenSlideText id="title">発表のはじめかた</OpenSlideText></h1>
 * ```
 */
export function OpenSlideText({ id, children }: OpenSlideTextProps): ReactNode {
	const ctx = useContext(OpenSlideTextContext);
	if (!ctx) return children;
	const override = ctx.text?.[openSlideTextKey(ctx.page, id)];
	if (ctx.editing) {
		return (
			<EditableText
				key={override ?? children}
				value={override ?? children}
				onCommit={(value) => ctx.commit({ page: ctx.page, id, value, defaultValue: children })}
			/>
		);
	}
	if (override === undefined) return children;
	return <span style={{ whiteSpace: "pre-line" }}>{override}</span>;
}

function normalize(text: string): string {
	return text.replace(/\r\n?/g, "\n");
}

interface EditableTextProps {
	value: string;
	onCommit: (value: string) => void;
}

function EditableText({ value, onCommit }: EditableTextProps) {
	const ref = useRef<HTMLSpanElement>(null);
	const commit = () => {
		const el = ref.current;
		if (!el) return;
		const next = normalize(el.innerText);
		if (next !== value) onCommit(next);
	};
	return (
		// biome-ignore lint/a11y/useSemanticElements: デッキの組版 (行の折り返し・書体) のまま書き換えるため、textarea ではなく文字そのものを編集可能にする
		<span
			ref={ref}
			role="textbox"
			aria-multiline="true"
			aria-label="スライドの文字"
			tabIndex={0}
			contentEditable="plaintext-only"
			suppressContentEditableWarning
			spellCheck={false}
			data-open-slide-text=""
			// ボードの選択・ドラッグやホストのキー操作 (Delete で Shape 削除など) を奪わない。
			onPointerDown={(e) => e.stopPropagation()}
			onDoubleClick={(e) => e.stopPropagation()}
			onKeyDown={(e) => {
				e.stopPropagation();
				if (e.key === "Escape") {
					e.preventDefault();
					e.currentTarget.blur();
				}
			}}
			onBlur={commit}
			style={{
				display: "inline-block",
				minWidth: "1ch",
				whiteSpace: "pre-wrap",
				outline: "3px dashed rgba(59,130,246,0.85)",
				outlineOffset: 6,
				borderRadius: 4,
				cursor: "text",
				pointerEvents: "auto",
				userSelect: "text",
			}}
		>
			{value}
		</span>
	);
}
