import { Header } from "@/components/Header";
import { TeacherCourseEditor } from "@/components/TeacherCourseEditor";
import { createCloudCourse } from "@/app/teacher/course-actions";
import { requireAdmin } from "@/lib/auth";
import type { CloudCourseDetail } from "@/lib/cloud-course-data";
import { getAdminCampOptions, getAdminCourseList } from "@/lib/cloud-course-data";

export default async function NewTeacherCoursePage() {
  await requireAdmin();
  const [camps, existing] = await Promise.all([getAdminCampOptions(), getAdminCourseList()]);
  const camp = camps.find((item) => item.slug === "reading-beta-7d") ?? camps[0];

  if (!camp) return <main className="app-shell"><section className="screen"><p className="notice">请先创建训练营，再创建课程。</p></section></main>;

  const nextDay = Math.max(0, ...existing.courses.filter((course) => course.campId === camp.id).map((course) => course.dayNumber)) + 1;
  const initialCourse: CloudCourseDetail = {
    id: "",
    campId: camp.id,
    dayNumber: nextDay,
    italianTitle: "",
    chineseTitle: "",
    description: "",
    readingText: "",
    reflectionPromptZh: "",
    reflectionPromptIt: "",
    unlockAt: null,
    status: "draft",
    isUnlocked: true,
    vocabulary: [],
  };
  const saveAction = createCloudCourse.bind(null, camp.id);

  return (
    <main className="app-shell"><section className="screen with-top">
      <Header title="新建云端课程" subtitle={camp.name} backHref="/teacher" />
      <section className="hero"><p className="kicker">New Course</p><h1>创建一节课程。</h1><p>新课程默认为草稿，不会立即展示给学生。</p></section>
      <TeacherCourseEditor course={initialCourse} saveAction={saveAction} />
    </section></main>
  );
}
