import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";

export default defineCloudflareConfig({
  // ISR/prerendered pages are persisted in R2 (NEXT_INC_CACHE_R2_BUCKET binding)
  // so they survive worker-isolate recycling — without this every cold isolate
  // re-renders the page (~2.5s: Supabase round-trips). withRegionalCache adds a
  // per-datacenter Cache-API layer in front of R2 for ~60ms warm hits.
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "long-lived" }),
});
