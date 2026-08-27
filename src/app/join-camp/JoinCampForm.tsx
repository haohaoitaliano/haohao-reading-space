"use client";

import { TicketCheck } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { joinCampAction, type JoinCampFormState } from "./actions";

const initialState: JoinCampFormState = { status: "idle", message: "" };

export function JoinCampForm() {
  const [state, formAction, pending] = useActionState(joinCampAction, initialState);

  return (
    <form action={formAction} className="quiet-card">
      <label className="field">
        训练营邀请码
        <input
          autoCapitalize="characters"
          autoComplete="off"
          name="invitationCode"
          placeholder="请输入训练营邀请码"
        />
      </label>
      {state.message ? (
        <p className={state.status === "success" ? "success-notice" : "notice"} role={state.status === "success" ? "status" : "alert"}>
          {state.campName ? `${state.message} ${state.campName}` : state.message}
        </p>
      ) : null}
      <button className="button full" disabled={pending} type="submit">
        <TicketCheck size={18} /> {pending ? "正在验证..." : "加入训练营"}
      </button>
      {state.status === "success" ? (
        <Link className="button secondary full" href="/spaces">查看我的学习空间</Link>
      ) : null}
    </form>
  );
}
