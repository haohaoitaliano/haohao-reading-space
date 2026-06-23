"use client";

import { TicketCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import {
  getCampInviteMessage,
  isCampInviteSuccess,
  redeemCampInvite,
} from "@/lib/camp-invite";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function JoinCampPage() {
  const [invitationCode, setInvitationCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invitationCode.trim()) {
      setError("请输入训练营邀请码");
      return;
    }

    setSubmitting(true);
    setError("");

    const result = await redeemCampInvite(createSupabaseBrowserClient(), invitationCode);
    if (isCampInviteSuccess(result.resultCode)) {
      window.location.assign("/home");
      return;
    }

    setError(getCampInviteMessage(result.resultCode));
    setSubmitting(false);
  }

  return (
    <main className="app-shell">
      <section className="screen">
        <div className="hero">
          <TicketCheck color="var(--accent)" size={42} />
          <p className="kicker" style={{ marginTop: 16 }}>加入训练营</p>
          <h1>输入训练营邀请码。</h1>
          <p>完成加入后即可查看课程、作业圈和学习进度。</p>
        </div>

        <form className="quiet-card" onSubmit={handleSubmit}>
          <label className="field">
            训练营邀请码
            <input
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(event) => setInvitationCode(event.target.value)}
              placeholder="请输入训练营邀请码"
              value={invitationCode}
            />
          </label>
          {error ? <p className="notice" role="alert">{error}</p> : null}
          <button className="button full" disabled={submitting} type="submit">
            <TicketCheck size={18} /> {submitting ? "正在验证..." : "加入训练营"}
          </button>
        </form>
      </section>
    </main>
  );
}
