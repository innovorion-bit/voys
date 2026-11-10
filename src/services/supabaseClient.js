// Re-export clean Supabase client and services from src/lib/supabase.js
export { 
  supabase, 
  supabase as realSupabase,
  isSupabaseConfigured, 
  dbService 
} from '../lib/supabase';
export { default } from '../lib/supabase';
