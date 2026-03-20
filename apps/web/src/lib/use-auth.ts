import { useMemo } from "react";
import { signOut, useSession } from "./auth-client.js";
import { devLogout, getDevUser, isDevMode } from "./dev-auth.js";

/**
 * 認証状態を統一的に取得するフック。
 * Better Authのセッションを優先し、DEV_MODEではdevユーザーにフォールバック。
 * 全依存をプリミティブ値にして参照安定性を保証する。
 */
export function useAuth() {
	const { data: session, isPending } = useSession();

	// Better Auth のセッションからプリミティブ値を抽出
	const sessionId = session?.user?.id ?? null;
	const sessionName = session?.user?.name ?? null;
	const sessionEmail = session?.user?.email ?? null;
	const sessionImage = session?.user?.image ?? null;

	// DEV_MODE のフォールバック
	const devId = isDevMode() ? (getDevUser()?.id ?? null) : null;
	const devName = isDevMode() ? (getDevUser()?.name ?? null) : null;

	const user = useMemo(() => {
		// DEV_MODE: devUserが設定されていればBetter Authセッションより優先
		if (devId && devName) {
			return {
				id: devId,
				name: devName,
				email: `${devId}@dev.local`,
				image: null as string | null,
			};
		}
		if (sessionId) {
			return {
				id: sessionId,
				name: sessionName,
				email: sessionEmail,
				image: sessionImage,
			};
		}
		return null;
	}, [sessionId, sessionName, sessionEmail, sessionImage, devId, devName]);

	const isDevUser = !sessionId && !!devId;

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
