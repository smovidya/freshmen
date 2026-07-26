CREATE TABLE `qte_schedule_limits` (
	`user_id` text PRIMARY KEY NOT NULL,
	`last_scheduled_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
