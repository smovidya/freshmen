CREATE TABLE `milestone_triggers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`threshold` integer NOT NULL,
	`game_type` text NOT NULL,
	`notified_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_milestone_triggers_user` ON `milestone_triggers` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_milestone_triggers_user_threshold` ON `milestone_triggers` (`user_id`,`threshold`);