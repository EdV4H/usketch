CREATE TABLE IF NOT EXISTS `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`thread_id` text DEFAULT 'default' NOT NULL,
	`author_id` text NOT NULL,
	`author_name` text NOT NULL,
	`text` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_chat_messages_board` ON `chat_messages` (`board_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_chat_messages_thread` ON `chat_messages` (`board_id`,`thread_id`,`created_at`);
