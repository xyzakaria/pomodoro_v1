/*
  # Add category to timer_sessions

  - Adds a text column "category" with default 'General'
  - Index on category for faster aggregations
*/

ALTER TABLE timer_sessions
ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'General';

CREATE INDEX IF NOT EXISTS timer_sessions_category_idx
ON timer_sessions (category);
