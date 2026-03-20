import { createAuthClient } from "better-auth/react";

const client = createAuthClient({
	baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8787",
});

export const useSession = client.useSession;
export const signIn = client.signIn;
export const signOut = client.signOut;
