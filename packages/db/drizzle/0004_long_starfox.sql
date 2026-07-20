CREATE TABLE `student_group` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`group_number` integer NOT NULL,
	`subgroup_number` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
