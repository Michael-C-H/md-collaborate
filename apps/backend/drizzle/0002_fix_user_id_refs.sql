-- Fix: update all FK references from SSO user_id to known_users.id
-- The migration 0001 added `id` as auto-increment but didn't align with existing user_id values.
-- This migration remaps all tables that stored SSO user_id to use known_users.id instead.

-- permissions.user_id
UPDATE `permissions` p
  JOIN `known_users` k ON p.user_id = k.user_id
  SET p.user_id = k.id
  WHERE k.user_id IS NOT NULL;--> statement-breakpoint

-- permissions.created_by
UPDATE `permissions` p
  JOIN `known_users` k ON p.created_by = k.user_id
  SET p.created_by = k.id
  WHERE k.user_id IS NOT NULL;--> statement-breakpoint

-- nodes.creator_id
UPDATE `nodes` n
  JOIN `known_users` k ON n.creator_id = k.user_id
  SET n.creator_id = k.id
  WHERE k.user_id IS NOT NULL;--> statement-breakpoint

-- nodes.deleted_by
UPDATE `nodes` n
  JOIN `known_users` k ON n.deleted_by = k.user_id
  SET n.deleted_by = k.id
  WHERE n.deleted_by IS NOT NULL AND k.user_id IS NOT NULL;--> statement-breakpoint

-- operation_log.user_id
UPDATE `operation_log` o
  JOIN `known_users` k ON o.user_id = k.user_id
  SET o.user_id = k.id
  WHERE k.user_id IS NOT NULL;--> statement-breakpoint

-- snapshots.created_by
UPDATE `snapshots` s
  JOIN `known_users` k ON s.created_by = k.user_id
  SET s.created_by = k.id
  WHERE k.user_id IS NOT NULL;--> statement-breakpoint

-- images.uploader_id
UPDATE `images` i
  JOIN `known_users` k ON i.uploader_id = k.user_id
  SET i.uploader_id = k.id
  WHERE k.user_id IS NOT NULL;
