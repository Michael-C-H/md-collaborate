CREATE TABLE `image_refs` (
	`image_id` bigint NOT NULL,
	`doc_id` bigint NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `pk_image_refs` PRIMARY KEY(`image_id`,`doc_id`)
);
--> statement-breakpoint
CREATE TABLE `images` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`url_token` char(32) NOT NULL,
	`storage_path` varchar(512) NOT NULL,
	`size_bytes` bigint NOT NULL,
	`mime_type` varchar(64) NOT NULL,
	`uploader_id` bigint NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `images_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_url_token` UNIQUE(`url_token`)
);
--> statement-breakpoint
CREATE TABLE `known_users` (
	`user_id` bigint NOT NULL,
	`username` varchar(64) NOT NULL,
	`display_name` varchar(128) NOT NULL,
	`role` varchar(32) NOT NULL,
	`first_login_at` datetime(3) NOT NULL,
	`last_login_at` datetime(3) NOT NULL,
	CONSTRAINT `known_users_user_id` PRIMARY KEY(`user_id`),
	CONSTRAINT `uk_username` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `nodes` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`parent_id` bigint,
	`type` varchar(8) NOT NULL,
	`name` varchar(100) NOT NULL,
	`path` varchar(512) NOT NULL,
	`depth` tinyint NOT NULL,
	`creator_id` bigint NOT NULL,
	`current_content` longtext,
	`content_updated_at` datetime(3),
	`yjs_state` longblob,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	`deleted_at` datetime(3),
	`deleted_by` bigint,
	CONSTRAINT `nodes_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_parent_name` UNIQUE(`parent_id`,`name`,`deleted_at`)
);
--> statement-breakpoint
CREATE TABLE `operation_log` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` bigint NOT NULL,
	`action` varchar(64) NOT NULL,
	`target_type` varchar(32) NOT NULL,
	`target_id` bigint,
	`detail` json,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `operation_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`node_id` bigint NOT NULL,
	`user_id` bigint NOT NULL,
	`role` varchar(16) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`created_by` bigint NOT NULL,
	CONSTRAINT `permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_node_user` UNIQUE(`node_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`doc_id` bigint NOT NULL,
	`version_no` bigint NOT NULL,
	`type` varchar(16) NOT NULL,
	`name` varchar(50),
	`restored_from` bigint,
	`content` longtext NOT NULL,
	`content_hash` char(64) NOT NULL,
	`created_by` bigint NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`expires_at` datetime(3),
	CONSTRAINT `snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_doc_version` UNIQUE(`doc_id`,`version_no`)
);
--> statement-breakpoint
CREATE INDEX `idx_display_name` ON `known_users` (`display_name`);--> statement-breakpoint
CREATE INDEX `idx_role` ON `known_users` (`role`);--> statement-breakpoint
CREATE INDEX `idx_parent` ON `nodes` (`parent_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_path` ON `nodes` (`path`);--> statement-breakpoint
CREATE INDEX `idx_deleted_at` ON `nodes` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_user_time` ON `operation_log` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_action` ON `operation_log` (`action`);--> statement-breakpoint
CREATE INDEX `idx_user` ON `permissions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_expires` ON `snapshots` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_doc_type` ON `snapshots` (`doc_id`,`type`);