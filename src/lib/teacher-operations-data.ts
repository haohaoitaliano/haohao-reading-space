import "server-only";

import { getAdminCampOptions, getActiveCampForUser, type CloudCamp } from "./cloud-course-data";
import { buildLearningProgress } from "./learning-progress";
import { createSupabaseServerClient } from "./supabase/server";

export type CampUsageCounts = {
  courses: number;
  members: number;
  meetings: number;
  invites: number;
  submissions: number;
};

export type ManagedCamp = CloudCamp & {
  maxStudents: number;
  counts: CampUsageCounts;
};

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

function increment(map: Map<string, number>, campId: string) {
  map.set(campId, (map.get(campId) ?? 0) + 1);
}

export async function getCampUsageCounts(campId: string): Promise<CampUsageCounts | null> {
  const supabase = await createSupabaseServerClient();
  const [courses, members, meetings, invites, submissions] = await Promise.all([
    supabase.from("courses").select("id", { count: "exact", head: true }).eq("camp_id", campId),
    supabase.from("camp_members").select("id", { count: "exact", head: true }).eq("camp_id", campId),
    supabase.from("weekly_meetings").select("id", { count: "exact", head: true }).eq("camp_id", campId),
    supabase.from("camp_invites").select("id", { count: "exact", head: true }).eq("camp_id", campId),
    supabase.from("student_submissions").select("id", { count: "exact", head: true }).eq("camp_id", campId),
  ]);
  if (courses.error || members.error || meetings.error || invites.error || submissions.error) return null;
  return {
    courses: courses.count ?? 0,
    members: members.count ?? 0,
    meetings: meetings.count ?? 0,
    invites: invites.count ?? 0,
    submissions: submissions.count ?? 0,
  };
}

export async function getAdminCampManagementData() {
  const supabase = await createSupabaseServerClient();
  const [campResult, coursesResult, membersResult, meetingsResult, invitesResult, submissionsResult] = await Promise.all([
    supabase.from("camps").select("id, name, slug, starts_at, timezone, status, max_students").order("created_at", { ascending: true }),
    supabase.from("courses").select("camp_id"),
    supabase.from("camp_members").select("camp_id"),
    supabase.from("weekly_meetings").select("camp_id"),
    supabase.from("camp_invites").select("camp_id"),
    supabase.from("student_submissions").select("camp_id"),
  ]);
  if (
    campResult.error || coursesResult.error || membersResult.error || meetingsResult.error
    || invitesResult.error || submissionsResult.error
  ) {
    return { error: true, camps: [] as ManagedCamp[] };
  }

  const maps = {
    courses: new Map<string, number>(),
    members: new Map<string, number>(),
    meetings: new Map<string, number>(),
    invites: new Map<string, number>(),
    submissions: new Map<string, number>(),
  };
  for (const row of (coursesResult.data ?? []) as Array<{ camp_id: string }>) increment(maps.courses, row.camp_id);
  for (const row of (membersResult.data ?? []) as Array<{ camp_id: string }>) increment(maps.members, row.camp_id);
  for (const row of (meetingsResult.data ?? []) as Array<{ camp_id: string }>) increment(maps.meetings, row.camp_id);
  for (const row of (invitesResult.data ?? []) as Array<{ camp_id: string }>) increment(maps.invites, row.camp_id);
  for (const row of (submissionsResult.data ?? []) as Array<{ camp_id: string }>) increment(maps.submissions, row.camp_id);

  return {
    error: false,
    camps: ((campResult.data ?? []) as Array<{
      id: string; name: string; slug: string; starts_at: string | null; timezone: string;
      status: "draft" | "active" | "archived"; max_students: number;
    }>).map((camp) => ({
      id: camp.id,
      name: camp.name,
      slug: camp.slug,
      startsAt: camp.starts_at,
      timezone: camp.timezone,
      status: camp.status,
      maxStudents: camp.max_students,
      counts: {
        courses: maps.courses.get(camp.id) ?? 0,
        members: maps.members.get(camp.id) ?? 0,
        meetings: maps.meetings.get(camp.id) ?? 0,
        invites: maps.invites.get(camp.id) ?? 0,
        submissions: maps.submissions.get(camp.id) ?? 0,
      },
    })),
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
