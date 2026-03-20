import { useMemo } from "react";
import { signOut, useSession } from "./auth-client.js";
import { devLogout, getDevUser, isDevMode } from "./dev-auth.js";

/**
 * 認証状態を統一的に取得するフック。
 * Better Authのセッションを優先し、DEV_MODEではdevユーザーにフォールバック。
 */
export function useAuth() {
	const { data: session, isPending } = useSession();

	const devId = isDevMode() ? (getDevUser()?.id ?? null) : null;
	const devName = isDevMode() ? (getDevUser()?.name ?? null) : null;

	const user = useMemo(() => {
		if (session?.user) return session.user;
		if (devId && devName) {
			return {
				id: devId,
				name: devName,
				email: `${devId}@dev.local`,
				image: null as string | null,
			};
		}
		return null;
	}, [session?.user, devId, devName]);

	const isDevUser = !session?.user && !!devId;

	const logout = useMemo(() => {
		if (isDevUser) {
			return () => {
				devLogout();
				window.location.reload();
			};
		}
		return () => signOut();
	}, [isDevUser]);

	return { user, isPending: !devId && isPending, isDevUser, logout };
}
