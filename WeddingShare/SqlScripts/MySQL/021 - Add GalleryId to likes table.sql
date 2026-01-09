--
-- Add `gallery_id` to `gallery_likes` table
--
ALTER TABLE `gallery_likes` ADD `gallery_id` BIGINT NOT NULL DEFAULT 0;