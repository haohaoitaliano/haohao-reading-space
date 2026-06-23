"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LogoutButton({ className = "button ghost full" }: { className?: string }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    setLoggingOut(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      router.replace("/login");
      router.refresh();
    } catch {
      setError("退出失败，请刷新页面后重试。");
      setLoggingOut(false);
    }
  }

  return (
    <div className="stack">
      <button className={className} disabled={loggingOut} onClick={handleLogout} type="button">
        <LogOut size={18} />
        {loggingOut ? "正在退出..." : "退出登录"}
      </button>
      {error ? <p className="notice" role="alert">{error}</p> : null}
    </div>
  );
}
