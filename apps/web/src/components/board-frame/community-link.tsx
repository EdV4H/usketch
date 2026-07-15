import { useNavigate } from "react-router";
import { I } from "../ui/index.js";

/**
 * コミュニティマップへのリンク。
 * `inline` のとき fixed をやめて親レイアウト（TopBar 等）に埋め込む。
 */
export function CommunityLink({ inline = false }: { inline?: boolean } = {}) {
	const navigate = useNavigate();
	return (
		<button
			type="button"
			onClick={() => navigate("/community")}
			className={inline ? undefined : "u-surface"}
			style={{
				...(inline
					? {}
					: {
							position: "fixed",
							bottom: 12,
							left: 172,
							zIndex: 25,
						}),
				padding: "7px 11px",
				display: "inline-flex",
				alignItems: "center",
				gap: 6,
				background: "transparent",
				border: "none",
				color: "var(--fg-secondary)",
				fontSize: 11.5,
				fontWeight: 500,
				borderRadius: 10,
				cursor: "pointer",
				fontFamily: "inherit",
			}}
		>
			<I.community size={12} /> コミュニティ
		</button>
	);
}
