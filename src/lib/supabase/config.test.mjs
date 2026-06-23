import assert from "node:assert/strict";
import test from "node:test";
import { getSupabaseConfig, isSupabaseConfigured } from "./config.ts";

test("reads the public Supabase configuration", () => {
  const config = getSupabaseConfig({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-publishable-key",
  });

  assert.deepEqual(config, {
    url: "https://example.supabase.co",
    publishableKey: "public-publishable-key",
  });
});

test("reports missing Supabase configuration", () => {
  assert.equal(isSupabaseConfigured({}), false);
  assert.equal(
    isSupabaseConfigured({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-publishable-key",
    }),
    true,
  );
  assert.throws(() => getSupabaseConfig({}), /Supabase environment variables are missing/);
});
