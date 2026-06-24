"use client";

import { useRouter } from "next/navigation";
import type { CloudCamp } from "@/lib/cloud-course-data";

export function TeacherCourseCampFilter({ camps, selectedCampId }: {
  camps: CloudCamp[];
  selectedCampId: string;
}) {
  const router = useRouter();
  return (
    <label className="field">筛选训练营
      <select
        onChange={(event) => router.replace(`/teacher?camp=${encodeURIComponent(event.target.value)}#cloud-courses`)}
        value={selectedCampId}
      >
        {camps.map((camp) => <option key={camp.id} value={camp.id}>{camp.name}</option>)}
      </select>
    </label>
  );
}
