"use client";

import { Ban, Copy, KeyRound, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createCampInvite, disableCampInvite } from "@/app/teacher/invite-actions";
import type { CloudCamp } from "@/lib/cloud-course-data";
import { formatUnlockDateTime } from "@/lib/course-schedule";
import type { CampInvite } from "@/lib/teacher-operations-data";

export function InviteManager({ camps, invites }: { camps: CloudCamp[]; invites: CampInvite[] }) {
  const router = useRouter();
  const [campId, setCampId] = useState(camps[0]?.id ?? "");
  const [code, setCode] = useState("");
  const [maxUses, setMaxUses] = useState(20);
  const [expiresAtLocal, setExpiresAtLocal] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  const [error, setError] = useState("");

  async function create() {
    setBusy(true); setError(""); setMessage("");
    const result = await createCampInvite({ campId, code, maxUses, expiresAtLocal });
    if (result.success) { setCreatedCode(code); setMessage(result.message); router.refresh(); }
    else setError(result.message);
    setBusy(false);
  }

  async function disable(inviteId: string) {
    setBusy(true); setError(""); setMessage("");
    const result = await disableCampInvite(inviteId);
    if (result.success) { setMessage(result.message); router.refresh(); }
    else setError(result.message);
    setBusy(false);
  }

  return (
    <div className="stack">
      <section className="quiet-card stack">
        <div className="row start"><div><p className="kicker">New Invite</p><h2>创建邀请码</h2></div><KeyRound color="var(--sky)" /></div>
        <label className="field">训练营
          <select onChange={(event) => setCampId(event.target.value)} value={campId}>
            {camps.map((camp) => <option key={camp.id} value={camp.id}>{camp.name}</option>)}
          </select>
        </label>
        <label className="field">邀请码
          <input autoCapitalize="characters" onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="例如 LETTURA02" value={code} />
        </label>
        <label className="field">最多使用次数
          <input min={1} onChange={(event) => setMaxUses(Number(event.target.value))} type="number" value={maxUses} />
        </label>
        <label className="field">有效期（训练营当地时间）
          <input onChange={(event) => setExpiresAtLocal(event.target.value)} type="datetime-local" value={expiresAtLocal} />
        </label>
        <p className="notice">邀请码明文只用于本次创建，数据库仅保存哈希和脱敏提示。</p>
        {error ? <p className="notice" role="alert">{error}</p> : null}
        {message ? <p className="success-notice" role="status">{message}</p> : null}
        {createdCode ? <div className="row"><strong>{createdCode}</strong><button className="button ghost" onClick={() => navigator.clipboard.writeText(createdCode)} title="复制邀请码" type="button"><Copy size={18} /> 复制</button></div> : null}
        <button className="button full" disabled={busy || !camps.length} onClick={create} type="button"><Plus size={18} /> 创建邀请码</button>
      </section>

      {invites.map((invite) => (
        <article className="item-card" key={invite.id}>
          <div className="row start"><div><p className="kicker">{invite.campName}</p><h3>{invite.codeHint}</h3></div>
            <span className={`pill ${invite.isActive ? "olive" : "muted"}`}>{invite.isActive ? "启用中" : "已停用"}</span>
          </div>
          <p>已使用 {invite.usedCount} / {invite.maxUses} 次</p>
          <p style={{ fontSize: 13 }}>有效期至：{formatUnlockDateTime(invite.expiresAt, invite.timezone)}（{invite.timezone}）</p>
          {invite.isActive ? <button className="button secondary full" disabled={busy} onClick={() => disable(invite.id)} type="button"><Ban size={18} /> 停用邀请码</button> : null}
        </article>
      ))}
      {!invites.length ? <p className="notice">当前还没有邀请码。</p> : null}
    </div>
  );
}
