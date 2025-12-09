import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface TimerSession {
  id: string;
  user_id: string;
  name: string;
  duration_minutes: number;
  completed_at: string;
  created_at: string;
  category?: string | null;    // subject name
  lecture_id?: string | null;  // link to Lecture
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Lecture {
  id: string;
  user_id: string;
  subject_name: string;    // = categories.name
  title: string;
  target_minutes: number | null;
  created_at: string;
}
