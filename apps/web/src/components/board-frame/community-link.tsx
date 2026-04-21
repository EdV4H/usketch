import { useNavigate } from "react-router";
import { I } from "../ui/index.js";

/** 画面左下（StatusBar の隣）: コミュニティマップへのリンク。 */
export function CommunityLink() {
	const navigate = useNavigate();
	return (
		<button
			type="button"
			onClick={() => navigate("/community")}
			className="u-surface"
			style={{
				position: "fixed",
				bottom: 12,
				left: 172,
				zIndex: 25,
				padding: "7px 11px",
				display: "inline-flex",
				alignItems: "center",
				gap: 6,
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
