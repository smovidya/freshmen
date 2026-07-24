CREATE TABLE `anomaly_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`detail` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_anomaly_events_user` ON `anomaly_events` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_anomaly_events_type` ON `anomaly_events` (`type`);--> statement-breakpoint
CREATE TABLE `pop_sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_pop_sessions_user` ON `pop_sessions` (`user_id`);