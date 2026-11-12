"use client";

import { useActionState } from "react";
import { IDENTITY_LABEL_TEXT, type IdentityLabel } from "@/lib/identity-label";
import { saveIdentityLabel } from "./actions";

export function IdentityLabelForm({ userId, value }: { userId: string; value: IdentityLabel }) {
  const [state, action, pending] = useActionState(saveIdentityLabel, {});
  return <form action={action} className="identity-label-form">
    <input name="userId" type="hidden" value={userId} />
    <label><span className="sr-only">身份标签</span><select defaultValue={value} name="identityLabel">
      {(Object.entries(IDENTITY_LABEL_TEXT) as Array<[IdentityLabel, string]>).map(([key, text]) => <option key={key} value={key}>{key === "student" ? "无特殊标签（纳入学员统计）" : text}</option>)}
    </select></label>
    <button className="button ghost" disabled={pending} type="submit">{pending ? "保存中…" : "保存标签"}</button>
    {state.error ? <span className="notice" role="alert">{state.error}</span> : null}
    {state.success ? <span className="success-note" role="status">{state.success}</span> : null}
  </form>;
}
