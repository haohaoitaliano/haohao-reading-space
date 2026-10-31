const DEFAULT_REPOSITORY = "haohaoitaliano/haohao-reading-space";
const WORKFLOW_FILE = "transcode-student-recording.yml";

export async function dispatchSubmissionCommentTranscode(commentId: string) {
  const token = process.env.GITHUB_TRANSCODE_TOKEN;
  if (!token) return "not_configured" as const;
  const repository = process.env.GITHUB_TRANSCODE_REPOSITORY || DEFAULT_REPOSITORY;
  const ref = process.env.GITHUB_TRANSCODE_REF || "main";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetch(`https://api.github.com/repos/${repository}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref, inputs: { comment_id: commentId } }),
      cache: "no-store",
      signal: controller.signal,
    });
    return response.status === 204 ? "triggered" as const : "failed" as const;
  } catch {
    return "failed" as const;
  } finally {
    clearTimeout(timeout);
  }
}
