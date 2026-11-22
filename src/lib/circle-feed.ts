import type { CloudSubmission } from "./circle-submission";
import type { CloudUnifiedAssignment } from "./photo-submission-data";

export const CIRCLE_PAGE_SIZE = 20;

export type CircleCursor = {
  createdAt: string;
  id: string;
};

export type CircleCandidate = CircleCursor & {
  source: "recording" | "assignment";
};

export type CircleCard = {
  submission: CloudSubmission;
  assignment?: CloudUnifiedAssignment;
};

export type CirclePagePayload = {
  cards: CircleCard[];
  nextCursor: string | null;
};

export function compareCircleCursor(left: CircleCursor, right: CircleCursor) {
  const dateOrder = right.createdAt.localeCompare(left.createdAt);
  return dateOrder || right.id.localeCompare(left.id);
}

export function selectCirclePageCandidates(candidates: CircleCandidate[]) {
  const sorted = [...candidates].sort(compareCircleCursor);
  return {
    page: sorted.slice(0, CIRCLE_PAGE_SIZE),
    hasMore: sorted.length > CIRCLE_PAGE_SIZE,
  };
}
