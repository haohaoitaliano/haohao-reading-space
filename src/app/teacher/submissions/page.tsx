import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CloudSubmissionCard } from "@/components/CloudSubmissionCard";
import { Header } from "@/components/Header";
import { PhotoSubmissionCard } from "@/components/PhotoSubmissionCard";
import { requireAdmin } from "@/lib/auth";
import { IDENTITY_LABEL_TEXT } from "@/lib/identity-label";
import { getAdminUserAssignments, getAdminUsers } from "@/lib/user-management-data";
import { IdentityLabelForm } from "./IdentityLabelForm";

function href(values: { q?: string; camp?: string; user?: string; workCamp?: string }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
  return `/teacher/submissions${params.size ? `?${params}` : ""}`;
}

export default async function TeacherUsersPage({ searchParams }: {
  searchParams: Promise<{ q?: string; camp?: string; user?: string; workCamp?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const result = await getAdminUsers();
  const needle = query.q?.trim().toLocaleLowerCase() ?? "";
  const campOptions = new Map<string, string>();
  result.users.forEach((user) => user.camps.forEach((camp) => campOptions.set(camp.id, camp.name)));
  const users = result.users.filter((user) =>
    (!needle || user.displayName.toLocaleLowerCase().includes(needle) || user.email.toLocaleLowerCase().includes(needle))
    && (!query.camp || user.camps.some((camp) => camp.id === query.camp && camp.active))
  );
  const selectedUser = result.users.find((user) => user.id === query.user);
  const requestedWorkCamp = query.workCamp ?? query.camp;
  const selectedCampId = selectedUser?.camps.some((camp) => camp.id === requestedWorkCamp)
    ? requestedWorkCamp!
    : (selectedUser?.camps.find((camp) => camp.active)?.id ?? selectedUser?.camps[0]?.id ?? "");
  const work = selectedUser && selectedCampId
    ? await getAdminUserAssignments(selectedUser.id, selectedCampId)
    : null;
  const unifiedById = new Map(work?.unified.assignments.map((item) => [item.assignmentId, item]) ?? []);

  return <main className="app-shell"><section className="screen with-top">
    <Header backHref="/teacher" subtitle="查找学员、查看所属训练营与作业" title="用户管理" />
    {result.error ? <p className="notice" role="alert">用户暂时无法读取，请稍后刷新；如持续出现，请检查服务端错误日志。</p> : null}
    {!selectedUser ? <>
      <form className="quiet-card user-filter-form" method="get">
        <label><span>搜索用户</span><input defaultValue={query.q ?? ""} name="q" placeholder="昵称或登录邮箱" /></label>
        <label><span>训练营</span><select defaultValue={query.camp ?? ""} name="camp"><option value="">全部训练营</option>{[...campOptions].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <button className="button" type="submit">查找</button>
      </form>
      <section className="stack user-list"><div className="row"><h2>用户</h2><span className="pill muted">{users.length} 人</span></div>
        {users.map((user) => <Link className="item-card user-card" href={href({ q: query.q, camp: query.camp, user: user.id })} id={`user-${user.id}`} key={user.id}>
          <div className="row start"><span className="avatar">{user.displayName.charAt(0) || "用"}</span><div className="user-card-copy"><div className="row start"><strong>{user.displayName}</strong>{user.identityLabel === "student" ? <span className="pill muted">无特殊标签</span> : <span className="pill olive">{IDENTITY_LABEL_TEXT[user.identityLabel]}</span>}</div><p>{user.email}</p><p>{user.camps.filter((camp) => camp.active).map((camp) => camp.name).join("、") || "尚未加入训练营"}</p></div></div>
        </Link>)}
        {!result.error && users.length === 0 ? <p className="notice">没有符合条件的用户。</p> : null}
      </section>
    </> : <section className="stack user-detail">
          <Link className="button ghost user-list-back" href={`${href({ q: query.q, camp: query.camp })}#user-${selectedUser.id}`}><ArrowLeft size={17} />返回用户列表</Link>
          <section className="quiet-card stack"><div><h2>{selectedUser.displayName}</h2><p>{selectedUser.email}</p></div><IdentityLabelForm userId={selectedUser.id} value={selectedUser.identityLabel} /><p className="form-help">系统权限：{selectedUser.systemRole === "admin" ? "管理员" : "普通用户"}（标签不会改变权限）</p><div className="row start wrap">{selectedUser.camps.map((camp) => <Link className={`pill ${camp.id === selectedCampId ? "sky" : "muted"}`} href={href({ q: query.q, camp: query.camp, user: selectedUser.id, workCamp: camp.id })} key={camp.id}>{camp.name}{camp.active ? "" : "（已移除）"}</Link>)}{selectedUser.camps.length === 0 ? <span className="pill muted">尚未加入训练营</span> : null}</div></section>
          {work ? <section className="stack"><h2>{campOptions.get(selectedCampId) ?? "训练营"}作业</h2>
            {work.legacyPhotos.submissions.map((item) => <PhotoSubmissionCard key={item.id} submission={item} />)}
            {work.recordings.submissions.map((item) => { const unified = unifiedById.get(item.id); return <CloudSubmissionCard assignmentId={unified?.assignmentId} key={item.id} photos={unified?.photos} showInteractions submission={unified ? { ...item, version: unified.version, createdAt: unified.createdAt } : item} />; })}
            {work.unified.assignments.filter((item) => !item.hasRecording).map((item) => <CloudSubmissionCard assignmentId={item.assignmentId} key={item.assignmentId} photos={item.photos} showInteractions submission={{ id: item.assignmentId, courseId: item.courseId, dayNumber: item.dayNumber, courseTitle: item.courseTitle, studentName: item.studentName, identityLabel: item.identityLabel, durationSeconds: 0, targetDurationSeconds: null, visibility: item.visibility, version: item.version, createdAt: item.createdAt, audioUrl: "", encouragementCount: 0, hasEncouraged: false, commentCount: item.commentCount, comments: [] }} />)}
            {!work.recordings.error && !work.legacyPhotos.error && !work.unified.error && work.recordings.submissions.length === 0 && work.legacyPhotos.submissions.length === 0 && work.unified.assignments.length === 0 ? <p className="notice">该用户在此训练营尚未提交作业。</p> : null}
            {work.recordings.error || work.legacyPhotos.error || work.unified.error ? <p className="notice" role="alert">部分作业暂时无法读取。</p> : null}
          </section> : null}
    </section>}
  </section></main>;
}
