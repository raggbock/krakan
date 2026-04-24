/**
 * Fixed-UUID references shared across edge functions. Keeping these
 * here removes duplication between the function source and the SQL
 * migrations that seed them.
 */

/**
 * Owner ID for proxy-imported flea markets, before an actual business
 * owner takes over via the takeover flow. Seeded in migrations
 * 00020_business_imports.sql and 00022_business_imports_system_user.sql.
 */
export const SYSTEM_OWNER_ID = 'f1d57000-1000-4000-8000-000000000001'
