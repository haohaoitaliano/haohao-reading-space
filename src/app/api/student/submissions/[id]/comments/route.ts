import { NextResponse, type NextRequest } from "next/server";
import { normalizeSubmissionComment, validateSubmissionComment } from "@/lib/submission-interaction";
import {
  buildSubmissionCommentMediaPath,
  getSubmissionCommentImageExtension,
  getSubmissionCommentImageMimeType,
  hasSubmissionCommentImageSignature,
  SUBMISSION_COMMENT_MEDIA_BUCKET,
  validateSubmissionCommentAudio,
  validateSubmissionCommentImage,
} from "@/lib/submission-comment-media";
import { getSubmissionInteractionContext } from "@/lib/submission-interaction-server";
import { dispatchSubmissionCommentTranscode } from "@/lib/submission-comment-transcode-dispatch";
import { getStudentRecordingExtension, normalizeStudentRecordingMimeType } from "@/lib/student-recording";

type RouteProps = { params: Promise<{ id: string }> };
type CommentRow = {
  id: string;
  user_id: string;
  author_display_name: string;
  author_role: "admin" | "student";
  content: string | null;
  parent_comment_id: string | null;
  audio_storage_path: string | null;
  image_storage_path: string | null;
  audio_transcode_status: string | null;
  created_at: string;
};

const selection = "id, user_id, author_display_name, author_role, content, parent_comment_id, audio_storage_path, image_storage_path, audio_transcode_status, created_at";

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

function mediaUploadFailure(kind: "录音" | "照片", error: { message?: string } | null) {
  const detail = error?.message?.toLowerCase() ?? "";
  if (detail.includes("bucket") && detail.includes("not found")) {
    return failure("多媒体评论存储尚未配置，需要先应用数据库 migration。", 503);
  }
  if (detail.includes("row-level security") || detail.includes("policy")) {
    return failure(`${kind}没有上传权限，请确认评论附件的 Storage RLS 已配置。`, 403);
  }
  return failure(`${kind}上传失败，请稍后重试。`, 500);
}

function serializeComment(row: CommentRow, currentUserId: string, targetId: string, authorNames: Map<string, string>) {
  return {
    id: row.id,
    authorName: row.author_display_name.trim() || "同学",
    authorRole: row.author_role,
    content: row.content,
    parentCommentId: row.parent_comment_id,
    replyToAuthorName: row.parent_comment_id ? authorNames.get(row.parent_comment_id) ?? "对方" : null,
    createdAt: row.created_at,
    isOwn: row.user_id === currentUserId,
    audioUrl: row.audio_storage_path
      ? `/api/student/submissions/${encodeURIComponent(targetId)}/comments/${encodeURIComponent(row.id)}/audio`
      : null,
    imageUrl: row.image_storage_path
      ? `/api/student/submissions/${encodeURIComponent(targetId)}/comments/${encodeURIComponent(row.id)}/image`
      : null,
  };
}

export async function GET(_: NextRequest, { params }: RouteProps) {
  const { id } = await params;
  const context = await getSubmissionInteractionContext(id);
  if (context.state === "unauthenticated") return failure("请先登录。", 401);
  if (context.state !== "ok") return failure("该作业不存在或无权查看评论。", 403);

  let commentsQuery = context.supabase
    .from("submission_comments")
    .select(selection)
    .order("created_at", { ascending: true });
  commentsQuery = context.targetColumn === "assignment_submission_id"
    ? commentsQuery.or(`assignment_submission_id.eq.${context.target.id},submission_id.eq.${context.target.id}`)
    : commentsQuery.eq("submission_id", context.target.id);
  const { data, error } = await commentsQuery;
  if (error) return failure("评论暂时无法读取，请稍后重试。", 500);
  const rows = (data ?? []) as CommentRow[];
  const authorNames = new Map(rows.map((row) => [row.id, row.author_display_name.trim() || "同学"]));
  return NextResponse.json({
    success: true,
    comments: rows.map((row) => serializeComment(row, context.auth.profile.id, id, authorNames)),
  });
}

export async function POST(request: NextRequest, { params }: RouteProps) {
  const { id } = await params;
  const context = await getSubmissionInteractionContext(id);
  if (context.state === "unauthenticated") return failure("请先登录。", 401);
  if (context.state !== "ok") return failure("该作业不存在或无权发布评论。", 403);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failure("无法读取评论内容，请重试。", 400);
  }
  const contentValue = formData.get("content");
  const rawContent = typeof contentValue === "string" ? contentValue : "";
  const audio = formData.get("audio");
  const image = formData.get("image");
  const audioFile = audio instanceof File && audio.size > 0 ? audio : null;
  const imageFile = image instanceof File && image.size > 0 ? image : null;
  const validationError = validateSubmissionComment(rawContent, Boolean(audioFile || imageFile));
  if (validationError) return failure(validationError, 400);

  const audioSource = formData.get("audioSource");
  const durationSeconds = Number(formData.get("audioDurationSeconds"));
  if (audioFile) {
    if (audioSource !== "browser_recording" && audioSource !== "manual_upload") {
      return failure("无法确认录音来源，请重新录制或选择。", 400);
    }
    const audioError = validateSubmissionCommentAudio(audioFile, audioSource);
    if (audioError) return failure(audioError, 400);
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 45) {
      return failure("录音时长必须在 45 秒以内。", 400);
    }
  }
  const imageMimeType = imageFile ? getSubmissionCommentImageMimeType(imageFile) : null;
  if (imageFile) {
    const imageError = validateSubmissionCommentImage(imageFile);
    if (imageError) return failure(imageError, 400);
    if (!imageMimeType || !(await hasSubmissionCommentImageSignature(imageFile, imageMimeType))) {
      return failure("所选文件不是有效的 JPG、PNG 或 WebP 照片。", 400);
    }
  }

  const commentId = crypto.randomUUID();
  const uploadedPaths: string[] = [];
  let audioPath: string | null = null;
  let audioMimeType: string | null = null;
  let imagePath: string | null = null;
  if (audioFile) {
    const extension = getStudentRecordingExtension(audioFile.name, audioFile.type);
    audioMimeType = normalizeStudentRecordingMimeType(audioFile.type)
      || (extension === "mp3" ? "audio/mpeg" : "audio/mp4");
    audioPath = buildSubmissionCommentMediaPath({ campId: context.campId, userId: context.auth.profile.id, commentId, kind: "audio", extension });
    const { error } = await context.supabase.storage.from(SUBMISSION_COMMENT_MEDIA_BUCKET)
      .upload(audioPath, audioFile, { contentType: audioMimeType, upsert: false });
    if (error) return mediaUploadFailure("录音", error);
    uploadedPaths.push(audioPath);
  }
  if (imageFile && imageMimeType) {
    imagePath = buildSubmissionCommentMediaPath({
      campId: context.campId,
      userId: context.auth.profile.id,
      commentId,
      kind: "image",
      extension: getSubmissionCommentImageExtension(imageMimeType),
    });
    const { error } = await context.supabase.storage.from(SUBMISSION_COMMENT_MEDIA_BUCKET)
      .upload(imagePath, imageFile, { contentType: imageMimeType, upsert: false });
    if (error) {
      if (uploadedPaths.length) await context.supabase.storage.from(SUBMISSION_COMMENT_MEDIA_BUCKET).remove(uploadedPaths);
      return mediaUploadFailure("照片", error);
    }
    uploadedPaths.push(imagePath);
  }

  const parentValue = formData.get("parentCommentId");
  const parentCommentId = typeof parentValue === "string" ? parentValue || null : null;
  const { data, error } = await context.supabase
    .from("submission_comments")
    .insert({
      id: commentId,
      [context.targetColumn]: context.target.id,
      user_id: context.auth.profile.id,
      content: normalizeSubmissionComment(rawContent) || null,
      parent_comment_id: parentCommentId,
      audio_storage_path: audioPath,
      audio_mime_type: audioMimeType,
      audio_size_bytes: audioFile?.size ?? null,
      audio_duration_seconds: audioFile ? durationSeconds : null,
      image_storage_path: imagePath,
      image_mime_type: imageMimeType,
      image_size_bytes: imageFile?.size ?? null,
    })
    .select(selection)
    .single<CommentRow>();
  if (error || !data) {
    if (uploadedPaths.length) await context.supabase.storage.from(SUBMISSION_COMMENT_MEDIA_BUCKET).remove(uploadedPaths);
    return failure("评论保存失败，请稍后重试。", 500);
  }
  if (data.audio_transcode_status === "pending") void dispatchSubmissionCommentTranscode(data.id);

  let replyToAuthorName: string | null = null;
  if (data.parent_comment_id) {
    const { data: parent } = await context.supabase.from("submission_comments")
      .select("author_display_name").eq("id", data.parent_comment_id)
      .maybeSingle<{ author_display_name: string }>();
    replyToAuthorName = parent?.author_display_name?.trim() || "对方";
  }
  return NextResponse.json({
    success: true,
    comment: { ...serializeComment(data, context.auth.profile.id, id, new Map()), replyToAuthorName },
  });
}
