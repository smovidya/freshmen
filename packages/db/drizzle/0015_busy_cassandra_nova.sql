CREATE TABLE `pop_rate_limits` (
	`user_id` text PRIMARY KEY NOT NULL,
	`last_pop_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
