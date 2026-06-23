"use client";

import { createContext, useContext } from "react";
import type { AuthProfile } from "@/lib/auth-policy";

const AuthProfileContext = createContext<AuthProfile | null>(null);

export function AuthProfileProvider({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: AuthProfile | null;
}) {
  return <AuthProfileContext.Provider value={profile}>{children}</AuthProfileContext.Provider>;
}

export function useAuthProfile() {
  return useContext(AuthProfileContext);
}

export function useDisplayName() {
  return useAuthProfile()?.display_name ?? "同学";
}
