"use client";

import { Save } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { updateNickname, type UpdateNicknameResult } from "./actions";

const initialState: UpdateNicknameResult = { success: false, message: "" };

export function NicknameForm({ initialDisplayName }: { initialDisplayName: string }) {
  const [state, formAction, pending] = useActionState(updateNickname, initialState);
  const [displayName, setDisplayName] = useState(initialDisplayName);

  useEffect(() => {
    if (state.success && state.displayName) setDisplayName(state.displayName);
  }, [state]);

  return (
    <form action={formAction} className="quiet-card" style={{ marginTop: 14 }}>
      <label className="field" htmlFor="profile-display-name">
        修改昵称
        <input
          autoComplete="nickname"
          id="profile-display-name"
          maxLength={20}
          name="displayName"
          onChange={(event) => setDisplayName(event.target.value)}
          required
          value={displayName}
        />
      </label>
      <p className="field-help">1–20 个字符。保存后，作业圈、评论和教师端会同步显示新昵称。</p>
      {state.message ? (
        <p className={state.success ? "success-note" : "notice"} role={state.success ? "status" : "alert"}>
          {state.message}
        </p>
      ) : null}
      <button className="button full" disabled={pending} type="submit">
        <Save size={18} /> {pending ? "正在保存..." : "保存昵称"}
      </button>
    </form>
  );
}
