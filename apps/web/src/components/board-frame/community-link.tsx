import { useNavigate } from "react-router";
import { I, IconBtn } from "../ui/index.js";

/**
 * コミュニティマップへのリンク。TopBar の他ボタンと揃えたアイコンボタン。
 */
export function CommunityLink() {
	const navigate = useNavigate();
	return <IconBtn icon={I.community} label="コミュニティ" onClick={() => navigate("/community")} />;
}
