"use client";

import { useRouter } from "next/navigation";
import type { CloudCamp } from "@/lib/cloud-course-data";

export function NewCourseCampSelector({ camps, selectedCampId }: {
  camps: CloudCamp[];
  selectedCampId: string;
}) {
  const router = useRouter();
  return (
    <section className="quiet-card">
      <label className="field">选择训练营
        <select
          onChange={(event) => router.replace(`/teacher/courses/new?camp=${encodeURIComponent(event.target.value)}`)}
          value={selectedCampId}
        >
          {camps.map((camp) => (
            <option key={camp.id} value={camp.id}>
              {camp.name} · {camp.status === "active" ? "开放" : camp.status === "draft" ? "草稿" : "已归档"}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
