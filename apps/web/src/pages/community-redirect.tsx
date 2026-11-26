import { Navigate, useParams } from "react-router";
import { regionRedirectPath } from "../lib/demo-board.js";

/** もとの地域の URL（`/community/:slug`）を、デモボードのそのページへ移す。 */
export function CommunityRedirect() {
	const { slug } = useParams<{ slug: string }>();
	return <Navigate to={regionRedirectPath(slug)} replace />;
}
