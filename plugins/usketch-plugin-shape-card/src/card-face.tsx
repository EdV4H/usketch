import type { CSSProperties, ReactElement } from "react";
import type { CardFace, CardText, CardTexture } from "./types.js";

/** テクスチャ定義 → 背景まわりの CSSProperties（純関数・テスト容易）。 */
export function faceTextureStyle(texture?: CardTexture): CSSProperties {
	if (!texture) return {};
	const style: CSSProperties = {};
	if (texture.color) style.background = texture.color;
	if (texture.image) {
		// URL に " や \ が含まれても壊れない / 注入されないよう JSON.stringify でエスケープ
		style.backgroundImage = `url(${JSON.stringify(texture.image)})`;
		if (texture.fit === "tile") {
			style.backgroundRepeat = "repeat";
		} else {
			style.backgroundRepeat = "no-repeat";
			style.backgroundPosition = "center";
			style.backgroundSize =
				texture.fit === "contain" ? "contain" : texture.fit === "fill" ? "100% 100%" : "cover";
		}
	}
	return style;
}

/** アンカー（align/vAlign）→ translate 量（純関数・テスト容易）。 */
export function anchorTranslate(
	align: CardText["align"] = "center",
	vAlign: CardText["vAlign"] = "middle",
): { tx: string; ty: string } {
	const tx = align === "left" ? "0%" : align === "right" ? "-100%" : "-50%";
	const ty = vAlign === "top" ? "0%" : vAlign === "bottom" ? "-100%" : "-50%";
	return { tx, ty };
}

function textStyle(t: CardText): CSSProperties {
	const unit = t.unit ?? "ratio";
	const left = unit === "ratio" ? `${t.x * 100}%` : `${t.x}px`;
	const top = unit === "ratio" ? `${t.y * 100}%` : `${t.y}px`;
	const { tx, ty } = anchorTranslate(t.align, t.vAlign);
	const rot = t.rotation ? ` rotate(${t.rotation}deg)` : "";
	return {
		position: "absolute",
		left,
		top,
		transform: `translate(${tx}, ${ty})${rot}`,
		transformOrigin: "center",
		textAlign: t.align ?? "center",
		fontSize: t.fontSize ?? 16,
		fontFamily: t.fontFamily ?? "system-ui, sans-serif",
		fontWeight: t.fontWeight ?? 400,
		fontStyle: t.italic ? "italic" : "normal",
		color: t.color ?? "#1e1e1e",
		letterSpacing: t.letterSpacing,
		lineHeight: t.lineHeight ?? 1.3,
		maxWidth: t.maxWidth,
		whiteSpace: t.maxWidth ? "normal" : "pre",
		wordBreak: t.maxWidth ? "break-word" : "normal",
		pointerEvents: "none",
	};
}

/**
 * 面（テクスチャ + テキスト配置）を描画する。card-type 作者が renderFront / renderBack で
 * 再利用できる共通レンダラ。
 */
export function renderFace(face: CardFace | undefined): ReactElement {
	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				overflow: "hidden",
				...faceTextureStyle(face?.texture),
			}}
		>
			{(face?.texts ?? []).map((t, i) => (
				<div key={`txt-${i}-${t.text.slice(0, 12)}`} style={textStyle(t)}>
					{t.text}
				</div>
			))}
		</div>
	);
}
