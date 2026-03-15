import { Xid } from "xid-ts";

export function generateId(): string {
	return new Xid().toString();
}
