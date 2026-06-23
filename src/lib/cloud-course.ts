export type CloudCourseStatus = "draft" | "published" | "archived";

export type CloudVocabularyItem = {
  id?: string;
  position: number;
  word: string;
  meaningZh: string;
};

export type CourseEditorInput = {
  dayNumber: number;
  italianTitle: string;
  chineseTitle: string;
  description: string;
  readingText: string;
  reflectionPromptZh: string;
  reflectionPromptIt: string;
  unlockAt: string | null;
  status: CloudCourseStatus;
  vocabulary: CloudVocabularyItem[];
};

export function getCourseRouteId(dayNumber: number) {
  return `giorno-${dayNumber}`;
}

export function parseCourseDay(value: string) {
  const match = /^(?:giorno-)?([1-9]\d*)$/.exec(value);
  return match ? Number(match[1]) : null;
}

export function isCourseUnlocked(unlockAt: string | null, now = new Date()) {
  if (!unlockAt) return true;
  const unlockTime = new Date(unlockAt).getTime();
  return Number.isFinite(unlockTime) && unlockTime <= now.getTime();
}

export function validateCourseEditorInput(input: CourseEditorInput) {
  if (!Number.isInteger(input.dayNumber) || input.dayNumber <= 0) {
    return "课程天数必须大于 0";
  }
  if (!input.italianTitle.trim()) return "请输入意大利语标题";
  if (!input.readingText.trim()) return "请输入阅读材料";
  if (!(["draft", "published", "archived"] as string[]).includes(input.status)) {
    return "课程状态不正确";
  }

  const positions = new Set<number>();
  for (const item of input.vocabulary) {
    if (!Number.isInteger(item.position) || item.position <= 0) return "词汇位置必须大于 0";
    if (!item.word.trim()) return "重点词汇不能为空";
    if (positions.has(item.position)) return "重点词汇位置不能重复";
    positions.add(item.position);
  }
  return null;
}
