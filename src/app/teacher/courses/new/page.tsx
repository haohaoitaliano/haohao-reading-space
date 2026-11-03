import { Header } from "@/components/Header";
import { TeacherCourseEditor } from "@/components/TeacherCourseEditor";
import { NewCourseCampSelector } from "@/components/NewCourseCampSelector";
import { createCloudCourse } from "@/app/teacher/course-actions";
import { requireAdmin } from "@/lib/auth";
import { selectCourseCamp } from "@/lib/cloud-course";
import type { CloudCourseDetail } from "@/lib/cloud-course-data";
import { getAdminCampOptions, getAdminCourseList } from "@/lib/cloud-course-data";

export default async function NewTeacherCoursePage({ searchParams }: {
  searchParams: Promise<{ camp?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const [camps, existing] = await Promise.all([getAdminCampOptions(), getAdminCourseList()]);
  const camp = selectCourseCamp(camps, query.camp);

  if (!camp) return <main className="app-shell"><section className="screen"><p className="notice">请先创建训练营，再创建课程。</p></section></main>;

  const campCourses = existing.courses.filter((course) => course.campId === camp.id);
  const hasIntroduction = campCourses.some((course) => course.dayNumber === 0);
  const nextDay = Math.max(0, ...campCourses.map((course) => course.dayNumber)) + 1;
  const initialCourse: CloudCourseDetail = {
    id: "",
    campId: camp.id,
    dayNumber: hasIntroduction ? nextDay : 0,
    italianTitle: hasIntroduction ? "" : "欢迎与试打卡",
    chineseTitle: "",
    description: "",
    readingText: "",
    reflectionPromptZh: "",
    reflectionPromptIt: "",
    unlockAt: null,
    unlockOverrideAt: null,
    automaticUnlockAt: null,
    unlockMode: "auto",
    timezone: camp.timezone,
    status: "draft",
    isUnlocked: true,
    maxDurationSeconds: 120,
    targetDurationSeconds: null,
    recordingAssignmentEnabled: true,
    photoAssignmentEnabled: false,
    vocabulary: [],
    audio: null,
    video: null,
    pdfs: [],
    submissionCount: 0,
  };
  const saveAction = createCloudCourse.bind(null, camp.id);

  return (
    <main className="app-shell"><section className="screen with-top">
      <Header title="新建云端课程" subtitle={camp.name} backHref="/teacher" />
      <section className="hero"><p className="kicker">New Course</p><h1>创建一节课程。</h1><p>新课程默认为草稿，不会立即展示给学生。</p></section>
      <NewCourseCampSelector camps={camps} selectedCampId={camp.id} />
      <TeacherCourseEditor course={initialCourse} saveAction={saveAction} />
    </section></main>
  );
}
