import { signOut, useSession } from "./auth-client.js";
import { devLogout, getDevUser, isDevMode } from "./dev-auth.js";

/**
 * 認証状態を統一的に取得するフック。
 * Better Authのセッションを優先し、DEV_MODEではdevユーザーにフォールバック。
 */
export function useAuth() {
	const { data: session, isPending } = useSession();

	if (session?.user) {
		return {
			user: session.user,
			isPending,
			isDevUser: false,
			logout: () => signOut(),
		};
	}

	if (isDevMode()) {
		const devUser = getDevUser();
		if (devUser) {
			return {
				user: {
					id: devUser.id,
					name: devUser.name,
					email: `${devUser.id}@dev.local`,
					image: null,
				},
				isPending: false,
				isDevUser: true,
				logout: () => {
					devLogout();
					window.location.reload();
				},
			};
		}
	}

	return {
		user: null,
		isPending,
		isDevUser: false,
		logout: () => signOut(),
	};
}
