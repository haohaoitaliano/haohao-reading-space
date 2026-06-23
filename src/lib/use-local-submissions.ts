"use client";

import { useCallback, useEffect, useState } from "react";
import { getLocalSubmissions, type LocalSubmission } from "./submission-store";

export function useLocalSubmissions() {
  const [submissions, setSubmissions] = useState<LocalSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    setLoading(true);
    getLocalSubmissions()
      .then((records) => {
        setSubmissions(records);
        setError("");
      })
      .catch(() => setError("本地作业读取失败，请刷新页面后重试。"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    getLocalSubmissions()
      .then((records) => {
        setSubmissions(records);
        setError("");
      })
      .catch(() => setError("本地作业读取失败，请刷新页面后重试。"))
      .finally(() => setLoading(false));
    window.addEventListener("haohao:submissions-changed", refresh);
    return () => window.removeEventListener("haohao:submissions-changed", refresh);
  }, [refresh]);

  return { submissions, loading, error, refresh };
}
