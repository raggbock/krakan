import { createGeo } from '@fyndstigen/shared'
import { supabase } from './supabase'
export const geo = createGeo(supabase)
