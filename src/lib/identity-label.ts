export type IdentityLabel = "student" | "teacher" | "helper";

export const IDENTITY_LABEL_TEXT: Record<IdentityLabel, string> = {
  student: "学员",
  teacher: "老师",
  helper: "小助手",
};

export function isIdentityLabel(value: string): value is IdentityLabel {
  return value === "student" || value === "teacher" || value === "helper";
}
