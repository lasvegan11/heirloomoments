import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Plan limits
export const PLAN_LIMITS = {
  free:  { max_uploads: 50,          retention_days: 7,   label: 'Free' },
  plus:  { max_uploads: 500,         retention_days: 90,  label: 'Plus' },
  pro:   { max_uploads: 999999,      retention_days: 365, label: 'Pro' },
}

// Generate a unique slug from event title
export function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    + '-' + Math.random().toString(36).slice(2, 7)
}
