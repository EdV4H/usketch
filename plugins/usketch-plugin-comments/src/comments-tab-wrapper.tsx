import type { EventBus } from "@edv4h/usketch-shared";
import { useEffect, useState } from "react";
import type { CommentClient } from "./comment-client.js";
import { CommentsTab } from "./comments-tab.js";

interface CommentsTabWrapperProps {
	client: CommentClient;
	events: EventBus;
}

export function CommentsTabWrapper({ client, events }: CommentsTabWrapperProps) {
	const [focusThreadId, setFocusThreadId] = useState<string | null>(null);

	useEffect(() => {
		return events.on<{ threadId: string }>("comments:focus-thread", ({ threadId }) => {
			setFocusThreadId(threadId);
		});
	}, [events]);

	return <CommentsTab client={client} events={events} focusThreadId={focusThreadId} />;
}
