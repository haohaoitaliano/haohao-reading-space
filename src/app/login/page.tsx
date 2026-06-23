"use client";

import Link from "next/link";
import { LockKeyhole, LogIn } from "lucide-react";
import { FormEvent, useState } from "react";
import { getSafePostLoginPath } from "@/lib/auth-redirect";
import { getPostLoginPath, type AuthProfile } from "@/lib/auth-policy";
import { validateLoginFields } from "@/lib/password-auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function LoginPage() {
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateLoginFields(email, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) throw signInError;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, role, status")
        .eq("id", data.user.id)
        .maybeSingle<AuthProfile>();

      if (!profile || profile.status !== "active") {
        window.location.assign("/forbidden");
        return;
      }

      const next = new URLSearchParams(window.location.search).get("next");
      const destination = getSafePostLoginPath(next, profile.role) ?? getPostLoginPath(profile.role);
      window.location.assign(destination);
    } catch {
      setError("邮箱或密码不正确，请重新输入。");
      setSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="screen">
        <div className="hero">
          <div className="brand-mark" style={{ width: 58, height: 58, marginBottom: 18 }}>好</div>
          <p className="kicker">7 天免费公测版</p>
          <h1>登录好好意语共读空间。</h1>
          <p>使用注册邮箱和密码继续学习。</p>
        </div>

        <form className="quiet-card" onSubmit={handleSubmit}>
          <label className="field">
            邮箱
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="请输入你的邮箱"
              type="email"
              value={email}
            />
          </label>
          <label className="field">
            密码
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入密码"
              type="password"
              value={password}
            />
          </label>
          {error ? <p className="notice" role="alert">{error}</p> : null}
          <button className="button full" disabled={!configured || submitting} type="submit">
            <LogIn size={18} />
            {submitting ? "正在登录..." : "登录"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 18 }}>
          还没有账号？ <Link href="/register">创建学生账号</Link>
        </p>
        {!configured ? <p className="notice" role="alert">尚未配置 Supabase。</p> : null}
        <p className="notice" style={{ marginTop: 14 }}>
          <LockKeyhole size={15} style={{ verticalAlign: "text-bottom" }} /> 管理员角色只能在 Supabase 后台设置。
        </p>
      </section>
    </main>
  );
}
