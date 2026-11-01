"use client";

import { Copy } from "lucide-react";
import { useState } from "react";

export function MeetingNumber({ value }: { value: string }) {
  const [copyStatus, setCopyStatus] = useState("");

  async function copyMeetingNumber() {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus("已复制");
    } catch {
      setCopyStatus("复制失败，请手动复制");
    }
  }

  return <div className="meeting-number stack">
    <p><strong>会议号：</strong><span>{value}</span></p>
    <button className="button secondary full" onClick={copyMeetingNumber} type="button"><Copy size={18} /> 复制会议号</button>
    {copyStatus ? <p className="copy-status" role="status">{copyStatus}</p> : null}
  </div>;
}
