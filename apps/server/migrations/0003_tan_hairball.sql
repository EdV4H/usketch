CREATE TABLE `community_boards` (
	`board_id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`display_name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`theme_color` text DEFAULT '#6366f1' NOT NULL,
	`icon` text DEFAULT '🏠' NOT NULL,
	`grid_x` integer DEFAULT 0 NOT NULL,
	`grid_y` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `community_boards_slug_unique` ON `community_boards` (`slug`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`thread_id` text DEFAULT 'default' NOT NULL,
	`author_id` text NOT NULL,
	`author_name` text NOT NULL,
	`text` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_chat_messages`("id", "board_id", "thread_id", "author_id", "author_name", "text", "created_at") SELECT "id", "board_id", "thread_id", "author_id", "author_name", "text", "created_at" FROM `chat_messages`;--> statement-breakpoint
DROP TABLE `chat_messages`;--> statement-breakpoint
ALTER TABLE `__new_chat_messages` RENAME TO `chat_messages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_chat_messages_board` ON `chat_messages` (`board_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_messages_thread` ON `chat_messages` (`board_id`,`thread_id`,`created_at`);
