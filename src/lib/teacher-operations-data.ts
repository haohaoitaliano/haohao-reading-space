import "server-only";

import { getAdminCampOptions, getActiveCampForUser, type CloudCamp } from "./cloud-course-data";
import { buildLearningProgress } from "./learning-progress";
import { createSupabaseServerClient } from "./supabase/server";

export type CampInvite = {
  id: string;
  campId: string;
  campName: string;
  timezone: string;
  codeHint: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
};

export type WeeklyMeeting = {
  id: string;
  campId: string;
  campName: string;
  timezone: string;
  title: string;
  scheduledAt: string;
  meetingUrl: string;
  description: string;
};

type InviteRow = {
  id: string; camp_id: string; code_hint: string | null; max_uses: number;
  used_count: number; expires_at: string | null; is_active: boolean; created_at: string;
  camps: { name: string; timezone: string } | null;
};

type MeetingRow = {
  id: string; camp_id: string; title: string; scheduled_at: string;
  meeting_url: string; description: string | null;
  camps: { name: string; timezone: string } | null;
};

function mapMeeting(row: MeetingRow): WeeklyMeeting {
  return {
    id: row.id,
    campId: row.camp_id,
    campName: row.camps?.name ?? "训练营",
    timezone: row.camps?.timezone ?? "Europe/Rome",
    title: row.title,
    scheduledAt: row.scheduled_at,
    meetingUrl: row.meeting_url,
    description: row.description ?? "",
  };
}

export async function getAdminInviteData() {
  const supabase = await createSupabaseServerClient();
  const [camps, inviteResult] = await Promise.all([
    getAdminCampOptions(),
    supabase
      .from("camp_invites")
      .select("id, camp_id, code_hint, max_uses, used_count, expires_at, is_active, created_at, camps(name, timezone)")
      .order("created_at", { ascending: false }),
  ]);
  return {
    camps,
    error: Boolean(inviteResult.error),
    invites: ((inviteResult.data ?? []) as unknown as InviteRow[]).map((row) => ({
      id: row.id,
      campId: row.camp_id,
      campName: row.camps?.name ?? "训练营",
      timezone: row.camps?.timezone ?? "Europe/Rome",
      codeHint: row.code_hint ?? "已隐藏",
      maxUses: row.max_uses,
      usedCount: row.used_count,
      expiresAt: row.expires_at,
      isActive: row.is_active,
      createdAt: row.created_at,
    } satisfies CampInvite)),
  };
}

export async function getAdminMeetingData() {
  const supabase = await createSupabaseServerClient();
  const [camps, meetingResult] = await Promise.all([
    getAdminCampOptions(),
    supabase
      .from("weekly_meetings")
      .select("id, camp_id, title, scheduled_at, meeting_url, description, camps(name, timezone)")
      .order("scheduled_at", { ascending: false }),
  ]);
  return {
    camps,
    error: Boolean(meetingResult.error),
    meetings: ((meetingResult.data ?? []) as unknown as MeetingRow[]).map(mapMeeting),
  };
}

export async function getStudentMeetingData(userId: string) {
  const campResult = await getActiveCampForUser(userId);
  if (campResult.state !== "ok") return { state: campResult.state, camp: null, meetings: [] as WeeklyMeeting[] };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("weekly_meetings")
    .select("id, camp_id, title, scheduled_at, meeting_url, description, camps(name, timezone)")
    .eq("camp_id", campResult.camp.id)
    .order("scheduled_at", { ascending: true });
  if (error) return { state: "database_error" as const, camp: campResult.camp, meetings: [] };
  return {
    state: "ok" as const,
    camp: campResult.camp,
    meetings: ((data ?? []) as unknown as MeetingRow[]).map(mapMeeting),
  };
}

type MemberRow = {
  camp_id: string;
  user_id: string;
  profiles: { display_name: string | null; role: string; status: string } | null;
};
type ScheduleRow = {
  id: string; camp_id: string; day_number: number; italian_title: string;
  status: "draft" | "published" | "archived"; effective_unlock_at: string | null;
};
type SubmissionRow = { camp_id: string; user_id: string; course_id: string };

export async function getAdminLearningProgress() {
  const supabase = await createSupabaseServerClient();
  const [camps, membersResult, coursesResult, submissionsResult] = await Promise.all([
    getAdminCampOptions(),
    supabase
      .from("camp_members")
      .select("camp_id, user_id, profiles(display_name, role, status)")
      .eq("status", "active"),
    supabase.rpc("get_course_schedule", { target_camp_id: null }),
    supabase.from("student_submissions").select("camp_id, user_id, course_id"),
  ]);
  if (membersResult.error || coursesResult.error || submissionsResult.error) {
    return { camps: [] as Array<{ camp: CloudCamp; students: ReturnType<typeof buildLearningProgress> }>, error: true };
  }

  const members = (membersResult.data ?? []) as unknown as MemberRow[];
  const courses = (coursesResult.data ?? []) as unknown as ScheduleRow[];
  const submissions = (submissionsResult.data ?? []) as SubmissionRow[];
  return {
    error: false,
    camps: camps.map((camp) => ({
      camp,
      students: buildLearningProgress({
        members: members.filter((row) =>
          row.camp_id === camp.id
          && row.profiles?.role === "student"
          && row.profiles.status === "active"
        ).map((row) => ({
          userId: row.user_id,
          displayName: row.profiles?.display_name?.trim() || "同学",
        })),
        courses: courses.filter((row) => row.camp_id === camp.id).map((row) => ({
          id: row.id,
          dayNumber: row.day_number,
          title: row.italian_title,
          status: row.status,
          effectiveUnlockAt: row.effective_unlock_at,
        })),
        submissions: submissions.filter((row) => row.camp_id === camp.id).map((row) => ({
          userId: row.user_id,
          courseId: row.course_id,
        })),
      }),
    })),
  };
}
