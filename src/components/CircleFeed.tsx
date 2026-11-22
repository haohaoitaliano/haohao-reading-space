"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CircleCard, CirclePagePayload } from "@/lib/circle-feed";
import { CloudSubmissionCard } from "./CloudSubmissionCard";

type CircleFeedProps = {
  campId: string;
  focusCommentId?: string;
  focusedSubmissionId?: string;
  initialCards: CircleCard[];
  initialError: boolean;
  initialNextCursor: string | null;
};

type SavedCirclePosition = {
  loadedCount: number;
  scrollY: number;
  savedAt: number;
};

const RESTORE_MAX_AGE_MS = 30 * 60 * 1000;

async function requestPage(cursor: string | null) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const response = await fetch(`/api/student/circle${query}`, { cache: "no-store" });
  const result = await response.json().catch(() => ({})) as Partial<CirclePagePayload> & { message?: string };
  if (!response.ok || !Array.isArray(result.cards)) {
    throw new Error(result.message || "作业圈暂时无法读取，请稍后重试。");
  }
  return result as CirclePagePayload;
}

function appendUniqueCards(current: CircleCard[], incoming: CircleCard[]) {
  const knownIds = new Set(current.map((card) => card.submission.id));
  return [...current, ...incoming.filter((card) => !knownIds.has(card.submission.id))];
}

export function CircleFeed({
  campId,
  focusCommentId,
  focusedSubmissionId,
  initialCards,
  initialError,
  initialNextCursor,
}: CircleFeedProps) {
  const [cards, setCards] = useState(initialCards);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState(initialError ? "作业圈暂时无法读取，请稍后重试。" : "");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestInFlightRef = useRef(false);
  const cardsRef = useRef(cards);
  const nextCursorRef = useRef(nextCursor);
  const storageKey = `haohao-circle-position:${campId}`;

  useEffect(() => { cardsRef.current = cards; }, [cards]);
  useEffect(() => { nextCursorRef.current = nextCursor; }, [nextCursor]);

  const loadMore = useCallback(async (cursor = nextCursorRef.current) => {
    if (requestInFlightRef.current || (!cursor && cardsRef.current.length > 0 && !error)) return;
    requestInFlightRef.current = true;
    setLoading(true);
    setError("");
    try {
      const result = await requestPage(cursor);
      setCards((current) => appendUniqueCards(current, result.cards));
      setNextCursor(result.nextCursor);
      nextCursorRef.current = result.nextCursor;
      return result;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "作业圈暂时无法读取，请稍后重试。");
      return null;
    } finally {
      requestInFlightRef.current = false;
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    let stopped = false;
    async function restorePositionAndFocusedWork() {
      let targetCount = initialCards.length;
      let savedScrollY = 0;
      try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null") as SavedCirclePosition | null;
        if (saved && Date.now() - saved.savedAt < RESTORE_MAX_AGE_MS) {
          targetCount = Math.max(targetCount, saved.loadedCount);
          savedScrollY = saved.scrollY;
        }
      } catch {
        try { sessionStorage.removeItem(storageKey); } catch { /* storage is optional */ }
      }

      let restoredCards = initialCards;
      let cursor = initialNextCursor;
      while (
        !stopped
        && cursor
        && (restoredCards.length < targetCount
          || Boolean(focusedSubmissionId && !restoredCards.some((card) => card.submission.id === focusedSubmissionId)))
      ) {
        const result = await requestPage(cursor).catch((caught) => {
          setError(caught instanceof Error ? caught.message : "作业圈暂时无法读取，请稍后重试。");
          return null;
        });
        if (!result) break;
        restoredCards = appendUniqueCards(restoredCards, result.cards);
        cursor = result.nextCursor;
      }
      if (stopped) return;
      setCards(restoredCards);
      setNextCursor(cursor);
      cardsRef.current = restoredCards;
      nextCursorRef.current = cursor;
      setRestoring(false);
      window.requestAnimationFrame(() => {
        if (savedScrollY > 0) window.scrollTo({ top: savedScrollY });
      });
    }
    void restorePositionAndFocusedWork();
    return () => { stopped = true; };
  }, [focusedSubmissionId, initialCards, initialNextCursor, storageKey]);

  useEffect(() => {
    const savePosition = () => {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({
          loadedCount: cardsRef.current.length,
          scrollY: window.scrollY,
          savedAt: Date.now(),
        } satisfies SavedCirclePosition));
      } catch { /* storage is optional */ }
    };
    window.addEventListener("pagehide", savePosition);
    return () => {
      savePosition();
      window.removeEventListener("pagehide", savePosition);
    };
  }, [storageKey]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !nextCursor || restoring || error || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void loadMore();
    }, { rootMargin: "700px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [error, loadMore, nextCursor, restoring]);

  return (
    <div className="stack">
      {cards.map(({ submission, assignment }) => (
        <CloudSubmissionCard
          assignmentId={assignment?.assignmentId}
          focusCommentId={submission.id === focusedSubmissionId ? focusCommentId : undefined}
          key={assignment?.assignmentId ?? submission.id}
          photos={assignment?.photos}
          showInteractions
          submission={submission}
        />
      ))}
      {cards.length === 0 && !error ? <p className="notice">当前训练营暂时没有可见作业。</p> : null}
      {error ? (
        <div className="notice" role="alert">
          <p style={{ marginTop: 0 }}>{error}</p>
          <button className="button ghost" disabled={loading} onClick={() => void loadMore()} type="button">
            <RefreshCw size={16} />重试
          </button>
        </div>
      ) : null}
      {loading ? <p className="notice" role="status">正在加载更多作业…</p> : null}
      {nextCursor && !error && !loading && !restoring ? (
        <button className="button ghost full" onClick={() => void loadMore()} type="button">加载更多</button>
      ) : null}
      <div aria-hidden="true" ref={sentinelRef} style={{ height: 1 }} />
    </div>
  );
}
