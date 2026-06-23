"use client";

import { useDisplayName } from "@/components/AuthProfileProvider";

export function useStudentNickname() {
  return useDisplayName();
}
