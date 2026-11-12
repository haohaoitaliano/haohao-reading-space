"use client";

import { BookOpenCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type CSSProperties } from "react";
import type { CloudCamp } from "@/lib/cloud-course-data";
import { getStudentCourseDayLabel } from "@/lib/cloud-course";
import type { AdminProgressCourse, ProgressMember } from "@/lib/learning-progress";

type CampProgress = {
  camp: CloudCamp;
  courses: AdminProgressCourse[];
  students: Array<ProgressMember & { submittedCourseIds: string[] }>;
};

type StudentFilter = "all" | "completed" | "incomplete";

export function TeacherLearningProgress({ camps, initialCampId }: {
  camps: CampProgress[];
  initialCampId: string;
}) {
  const router = useRouter();
  const [campId, setCampId] = useState(initialCampId);
  const [mode, setMode] = useState<"daily" | "cumulative">("daily");
  const [studentFilter, setStudentFilter] = useState<StudentFilter>("all");
  const selectedCamp = camps.find((item) => item.camp.id === campId) ?? camps[0];
  const initialCamp = camps.find((item) => item.camp.id === initialCampId) ?? camps[0];
  const [courseGroupIndex, setCourseGroupIndex] = useState(Math.max(0, Math.ceil((initialCamp?.courses.length ?? 0) / 10) - 1));
  const latestCourseId = selectedCamp?.courses.at(-1)?.id ?? "";
  const [courseId, setCourseId] = useState(latestCourseId);

  const selectedCourse = useMemo(
    () => selectedCamp?.courses.find((course) => course.id === courseId) ?? selectedCamp?.courses.at(-1),
    [courseId, selectedCamp],
  );
  const students = useMemo(() => selectedCamp?.students.map((student) => {
    const submittedCount = student.submittedCourseIds.length;
    const completed = mode === "daily"
      ? Boolean(selectedCourse && student.submittedCourseIds.includes(selectedCourse.id))
      : submittedCount === selectedCamp.courses.length;
    return { ...student, completed, submittedCount };
  }) ?? [], [mode, selectedCamp, selectedCourse]);
  const completedCount = students.filter((student) => student.completed).length;
  const incompleteCount = students.length - completedCount;
  const completionRate = students.length ? Math.round((completedCount / students.length) * 100) : 0;
  const cumulativeCompletionRate = students.length && selectedCamp.courses.length
    ? Math.round((students.reduce((total, student) => total + student.submittedCount, 0)
      / (students.length * selectedCamp.courses.length)) * 100)
    : 0;
  const courseRates = useMemo(() => selectedCamp.courses.map((course) => {
    const completed = selectedCamp.students.filter((student) => student.submittedCourseIds.includes(course.id)).length;
    return {
      ...course,
      rate: selectedCamp.students.length ? Math.round((completed / selectedCamp.students.length) * 100) : 0,
    };
  }), [selectedCamp]);
  const courseGroupCount = Math.max(1, Math.ceil(courseRates.length / 10));
  const activeCourseGroupIndex = Math.min(courseGroupIndex, courseGroupCount - 1);
  const visibleCourseRates = courseRates.slice(activeCourseGroupIndex * 10, activeCourseGroupIndex * 10 + 10);
  const visibleStudents = students.filter((student) =>
    studentFilter === "all" || (studentFilter === "completed" ? student.completed : !student.completed)
  );

  if (!selectedCamp) return <p className="notice">还没有可管理的训练营。</p>;

  function changeCamp(nextCampId: string) {
    const nextCamp = camps.find((item) => item.camp.id === nextCampId);
    setCampId(nextCampId);
    setCourseId(nextCamp?.courses.at(-1)?.id ?? "");
    setCourseGroupIndex(Math.max(0, Math.ceil((nextCamp?.courses.length ?? 0) / 10) - 1));
    setStudentFilter("all");
    router.replace(`/teacher/progress?camp=${encodeURIComponent(nextCampId)}`, { scroll: false });
  }

  function changeMode(nextMode: "daily" | "cumulative") {
    setMode(nextMode);
    setStudentFilter("all");
  }

  function changeCourse(nextCourseId: string) {
    setCourseId(nextCourseId);
    setStudentFilter("all");
  }

  return <section className="stack">
    <label className="field">选择训练营
      <select onChange={(event) => changeCamp(event.target.value)} value={selectedCamp.camp.id}>
        {camps.map(({ camp }) => <option key={camp.id} value={camp.id}>{camp.name}</option>)}
      </select>
    </label>

    <div aria-label="查看模式" className="grid-two" role="group">
      <button aria-pressed={mode === "daily"} className={`button full ${mode === "daily" ? "" : "ghost"}`} onClick={() => changeMode("daily")} type="button">单日打卡</button>
      <button aria-pressed={mode === "cumulative"} className={`button full ${mode === "cumulative" ? "" : "ghost"}`} onClick={() => changeMode("cumulative")} type="button">累计进度</button>
    </div>

    {!selectedCamp.courses.length ? <p className="notice">暂无需打卡课程</p> : null}

    {selectedCamp.courses.length && mode === "daily" ? <>
      <label className="field">选择课程
        <select onChange={(event) => changeCourse(event.target.value)} value={selectedCourse?.id ?? ""}>
          {selectedCamp.courses.map((course) => <option key={course.id} value={course.id}>{getStudentCourseDayLabel(course.dayNumber)} · {course.title}</option>)}
        </select>
      </label>
      <div className="row start"><div><p className="kicker">Daily Check-in</p><h2>{selectedCourse ? `${getStudentCourseDayLabel(selectedCourse.dayNumber)} · ${selectedCourse.title}` : "单日打卡"}</h2></div><BookOpenCheck color="var(--olive)" /></div>
    </> : null}

    {selectedCamp.courses.length && mode === "cumulative" ? <>
      <h2 style={{ margin: 0 }}>累计打卡率 {cumulativeCompletionRate}%</h2>
      <section aria-label="每节课打卡率" className="quiet-card cumulative-course-chart">
        <div className="cumulative-course-chart-nav">
          <button className="button ghost" disabled={activeCourseGroupIndex === 0} onClick={() => setCourseGroupIndex((value) => Math.max(0, value - 1))} type="button">上10节</button>
          <span>{activeCourseGroupIndex + 1} / {courseGroupCount}</span>
          <button className="button ghost" disabled={activeCourseGroupIndex >= courseGroupCount - 1} onClick={() => setCourseGroupIndex((value) => Math.min(courseGroupCount - 1, value + 1))} type="button">下10节</button>
        </div>
        <div className="cumulative-course-bars">
          {visibleCourseRates.map((course) => <div className="cumulative-course-row" key={course.id}>
            <span>Giorno {course.dayNumber}</span>
            <div aria-label={`Giorno ${course.dayNumber} 打卡率 ${course.rate}%`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={course.rate} className="progress-bar cumulative-course-bar" role="progressbar"><span style={{ "--value": `${course.rate}%` } as CSSProperties} /></div>
            <strong>{course.rate}%</strong>
          </div>)}
        </div>
      </section>
    </> : null}

    {selectedCamp.courses.length ? <>
      {mode === "daily" ? <section aria-label="完成情况统计" className="quiet-card stack">
        <div className="progress-summary-grid">
          <div className="metric"><strong>{students.length}</strong><span>学员总数</span></div>
          <div className="metric"><strong>{completedCount}</strong><span>已完成</span></div>
          <div className="metric"><strong>{incompleteCount}</strong><span>未完成</span></div>
        </div>
        <div aria-label={`完成率 ${completionRate}%`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={completionRate} className="progress-bar" role="progressbar">
          <span style={{ "--value": `${completionRate}%` } as CSSProperties} />
        </div>
        <p style={{ margin: 0 }}>完成率 {completionRate}% · 已完成 {completedCount} / {students.length} 人</p>
      </section> : null}

      <div aria-label="学员名单筛选" className="progress-filter-grid" role="group">
        <button aria-pressed={studentFilter === "all"} className={`button full ${studentFilter === "all" ? "" : "ghost"}`} onClick={() => setStudentFilter("all")} type="button">全部</button>
        <button aria-pressed={studentFilter === "completed"} className={`button full ${studentFilter === "completed" ? "" : "ghost"}`} onClick={() => setStudentFilter("completed")} type="button">已完成</button>
        <button aria-pressed={studentFilter === "incomplete"} className={`button full ${studentFilter === "incomplete" ? "" : "ghost"}`} onClick={() => setStudentFilter("incomplete")} type="button">未完成</button>
      </div>

      {!students.length ? <p className="notice">当前没有 active 学生。</p> : null}
      {students.length && !visibleStudents.length ? <p className="notice">没有符合当前筛选条件的学员。</p> : null}
      {visibleStudents.map((student) => <article className="item-card" key={student.userId}>
        <div className="row start"><div><h3 style={{ margin: 0 }}>{student.displayName}</h3>{mode === "cumulative" ? <p style={{ margin: "6px 0 0" }}>已提交 {student.submittedCount} / {selectedCamp.courses.length} 节</p> : null}</div><span className={`pill ${student.completed ? "olive" : "muted"}`}>{student.completed ? "已完成" : "未完成"}</span></div>
      </article>)}
    </> : null}
  </section>;
}
