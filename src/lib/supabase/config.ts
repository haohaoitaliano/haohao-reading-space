type PublicSupabaseEnvironment = Record<string, string | undefined>;

function getRuntimeEnvironment(): PublicSupabaseEnvironment {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function isSupabaseConfigured(environment: PublicSupabaseEnvironment = getRuntimeEnvironment()) {
  return Boolean(
    environment.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  );
}

export function getSupabaseConfig(environment: PublicSupabaseEnvironment = getRuntimeEnvironment()) {
  if (!isSupabaseConfigured(environment)) {
    throw new Error("Supabase environment variables are missing");
  }

  return {
    url: environment.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    publishableKey: environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!.trim(),
  };
}
