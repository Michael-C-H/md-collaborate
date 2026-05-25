-- Step 1: Add `id` column (non-auto-increment first, to copy existing data)
ALTER TABLE `known_users` ADD `id` bigint NOT NULL DEFAULT 0 FIRST;--> statement-breakpoint

-- Step 2: Copy existing user_id to id (preserves FK references in other tables)
UPDATE `known_users` SET `id` = `user_id`;--> statement-breakpoint

-- Step 3: Drop old primary key and set new one
ALTER TABLE `known_users` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `known_users` ADD PRIMARY KEY(`id`);--> statement-breakpoint

-- Step 4: Make `id` auto-increment (starts from max(id)+1 for new rows)
ALTER TABLE `known_users` MODIFY COLUMN `id` bigint AUTO_INCREMENT NOT NULL;--> statement-breakpoint

-- Step 5: Make `user_id` nullable (LOCAL users won't have it)
ALTER TABLE `known_users` MODIFY COLUMN `user_id` bigint;--> statement-breakpoint

-- Step 6: Add new columns
ALTER TABLE `known_users` ADD `login_type` varchar(8) DEFAULT 'SSO' NOT NULL;--> statement-breakpoint
ALTER TABLE `known_users` ADD `password_hash` varchar(128);--> statement-breakpoint
CREATE INDEX `idx_login_type` ON `known_users` (`login_type`);
