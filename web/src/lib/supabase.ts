// Re-export the browser client from the new SSR-aware module so existing
// `import { supabase } from '@/lib/supabase'` call sites keep working
// without code changes. New code should import from @/lib/supabase/browser
// (client components) or call createSupabaseServerClient() from
// @/lib/supabase/server (server components / route handlers).
//
// Cookies-instead-of-localStorage migration tracked in task #3.
export { supabase } from './supabase/browser'
