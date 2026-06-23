import { StudentCourseDetail } from "@/components/StudentCourseDetail";
import { createLocalCourseData } from "@/lib/course-local-store";
import { assignments, getCourse } from "@/lib/mock-data";

type CoursePageProps = {
  params: Promise<{ id: string }>;
};

export default async function CoursePage({ params }: CoursePageProps) {
  const { id } = await params;
  const course = getCourse(id);
  const courseAssignments = assignments.filter((assignment) => assignment.courseId === course.id);

  return (
    <StudentCourseDetail
      assignments={courseAssignments}
      defaultCourse={createLocalCourseData(course)}
      mockAudioDuration={course.duration}
      mockAudioTitle={course.audioTitle}
    />
  );
}
