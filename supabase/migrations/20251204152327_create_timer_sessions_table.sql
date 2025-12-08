/*
  # Create Timer Sessions Table

  1. New Tables
    - `timer_sessions`
      - `id` (uuid, primary key) - Unique identifier for each session
      - `user_id` (uuid, foreign key) - References the authenticated user
      - `name` (text) - Custom name for the timer session
      - `duration_minutes` (integer) - Duration of the completed session in minutes
      - `completed_at` (timestamptz) - When the session was completed
      - `created_at` (timestamptz) - When the session record was created

  2. Security
    - Enable RLS on `timer_sessions` table
    - Add policy for users to read their own timer sessions
    - Add policy for users to create their own timer sessions
    - Add policy for users to update their own timer sessions
    - Add policy for users to delete their own timer sessions

  3. Indexes
    - Add index on user_id for faster queries
    - Add index on completed_at for sorting by date
*/

CREATE TABLE IF NOT EXISTS timer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Pomodoro Session',
  duration_minutes integer NOT NULL,
  completed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE timer_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own timer sessions"
  ON timer_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own timer sessions"
  ON timer_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own timer sessions"
  ON timer_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own timer sessions"
  ON timer_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS timer_sessions_user_id_idx ON timer_sessions(user_id);
CREATE INDEX IF NOT EXISTS timer_sessions_completed_at_idx ON timer_sessions(completed_at DESC);