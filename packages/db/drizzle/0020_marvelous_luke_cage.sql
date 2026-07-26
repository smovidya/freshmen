CREATE TABLE `turnstile_verifications` (
	`user_id` text PRIMARY KEY NOT NULL,
	`verified_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
