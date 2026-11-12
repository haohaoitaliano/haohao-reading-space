"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useTransition } from "react";

export function WorkRecordsSection({
  children,
  count,
  countError,
  expanded,
  loadFailed,
}: {
  children?: ReactNode;
  count: number;
  countError: boolean;
  expanded: boolean;
  loadFailed: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function loadWork() {
    if (pending) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("work", "1");
    startTransition(() => router.push(`${pathname}?${params}`));
  }

  function retry() {
    if (pending) return;
    startTransition(() => router.refresh());
  }

  return <section className="stack user-work-records">
    <div className="row wrap"><h2>作业记录 · 共 {countError ? "—" : count} 份</h2>
      {!expanded ? <button className="button secondary" disabled={pending || countError} onClick={loadWork} type="button">{pending ? "正在加载…" : "查看作业"}</button> : null}
    </div>
    {pending ? <p className="notice" role="status">正在加载…</p> : null}
    {countError ? <p className="notice" role="alert">作业总数暂时无法读取，请刷新后重试。</p> : null}
    {expanded && loadFailed && !pending ? <div className="notice" role="alert"><span>部分作业暂时无法读取。</span><button className="button ghost" onClick={retry} type="button">重试</button></div> : null}
    {expanded && !pending ? children : null}
  </section>;
}
