import { createSupabaseAuth } from '@fyndstigen/shared'
import { supabase } from './supabase'
export const auth = createSupabaseAuth(supabase)
