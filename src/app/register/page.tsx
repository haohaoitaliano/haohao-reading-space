"use client";

import Link from "next/link";
import { UserPlus } from "lucide-react";
import { FormEvent, useState } from "react";
import {
  getCampInviteMessage,
  isCampInviteSuccess,
  redeemCampInvite,
} from "@/lib/camp-invite";
import { validateRegistrationFields } from "@/lib/password-auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function RegisterPage() {
  const configured = isSupabaseConfigured();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateRegistrationFields(
      displayName,
      email,
      password,
      passwordConfirmation,
      invitationCode,
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { display_name: displayName.trim() } },
      });
      if (signUpError) throw signUpError;

      if (data.session) {
        const inviteResult = await redeemCampInvite(supabase, invitationCode);
        if (isCampInviteSuccess(inviteResult.resultCode)) {
          window.location.assign("/home");
          return;
        }

        setError(`账号已创建，但未能加入训练营：${getCampInviteMessage(inviteResult.resultCode)}`);
        return;
      }

      setMessage("账号已创建。请完成邮箱确认并登录，然后在加入训练营页面输入邀请码。");
    } catch {
      setError("注册失败。邮箱可能已注册，或密码不符合要求。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="screen">
        <div className="hero">
          <div className="brand-mark" style={{ width: 58, height: 58, marginBottom: 18 }}>好</div>
          <p className="kicker">学生注册</p>
          <h1>创建你的共读账号。</h1>
          <p>新账号会自动获得 student 角色。</p>
        </div>

        <form className="quiet-card" onSubmit={handleSubmit}>
          <label className="field">昵称
            <input autoComplete="nickname" onChange={(event) => setDisplayName(event.target.value)} placeholder="请输入你的昵称" value={displayName} />
          </label>
          <label className="field">邮箱
            <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="请输入你的邮箱" type="email" value={email} />
          </label>
          <label className="field">密码
            <input autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} placeholder="至少 6 个字符" type="password" value={password} />
          </label>
          <label className="field">确认密码
            <input autoComplete="new-password" onChange={(event) => setPasswordConfirmation(event.target.value)} placeholder="请再次输入密码" type="password" value={passwordConfirmation} />
          </label>
          <label className="field">训练营邀请码
            <input
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(event) => setInvitationCode(event.target.value)}
              placeholder="请输入训练营邀请码"
              value={invitationCode}
            />
          </label>
          <p className="notice">邀请码由训练营管理员提供，系统会在注册后安全验证。</p>
          {message ? <p className="success-notice" role="status">{message}</p> : null}
          {error ? <p className="notice" role="alert">{error}</p> : null}
          <button className="button full" disabled={!configured || submitting} type="submit">
            <UserPlus size={18} /> {submitting ? "正在注册..." : "创建账号"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 18 }}>已有账号？ <Link href="/login">返回登录</Link></p>
        <p style={{ textAlign: "center", marginTop: 10 }}><Link href="/join-camp">已注册？加入训练营</Link></p>
        {!configured ? <p className="notice" role="alert">尚未配置 Supabase。</p> : null}
      </section>
    </main>
  );
}
