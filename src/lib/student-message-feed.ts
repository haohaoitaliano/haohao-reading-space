import type { StudentMessage } from "./student-message";

export const STUDENT_MESSAGE_PAGE_SIZE = 5;

export type StudentMessageCursor = {
  createdAt: string;
  id: string;
};

export type StudentMessagePagePayload = {
  messages: StudentMessage[];
  nextCursor: string | null;
};

export function compareStudentMessageCursor(left: StudentMessageCursor, right: StudentMessageCursor) {
  const dateOrder = right.createdAt.localeCompare(left.createdAt);
  return dateOrder || right.id.localeCompare(left.id);
}

export function selectStudentMessagePage(messages: StudentMessage[]) {
  const sorted = [...messages].sort(compareStudentMessageCursor);
  return {
    page: sorted.slice(0, STUDENT_MESSAGE_PAGE_SIZE),
    hasMore: sorted.length > STUDENT_MESSAGE_PAGE_SIZE,
  };
}
