const DEFAULT_REPOSITORY = "haohaoitaliano/haohao-reading-space";
const WORKFLOW_FILE = "transcode-student-recording.yml";
const DISPATCH_TIMEOUT_MS = 3_000;

export type TranscodeDispatchResult = "triggered" | "not_configured" | "failed";

export async function dispatchStudentRecordingTranscode(
  submissionId: string,
): Promise<TranscodeDispatchResult> {
  const token = process.env.GITHUB_TRANSCODE_TOKEN;
  if (!token) return "not_configured";

  const repository = process.env.GITHUB_TRANSCODE_REPOSITORY || DEFAULT_REPOSITORY;
  const ref = process.env.GITHUB_TRANSCODE_REF || "main";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.github.com/repos/${repository}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ ref, inputs: { submission_id: submissionId } }),
        cache: "no-store",
        signal: controller.signal,
      },
    );
    return response.status === 204 ? "triggered" : "failed";
  } catch {
    return "failed";
  } finally {
    clearTimeout(timeout);
  }
}
