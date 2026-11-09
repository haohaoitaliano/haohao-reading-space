"use client";

import Link from "next/link";
import { type ComponentProps, type MouseEvent, useEffect, useRef, useState } from "react";

type StudentNavigationLinkProps = ComponentProps<typeof Link>;

const NAVIGATION_TIMEOUT_MS = 10_000;

export function StudentNavigationLink({ children, onClick, ...props }: StudentNavigationLinkProps) {
  const [pending, setPending] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;

    if (pending) {
      event.preventDefault();
      return;
    }

    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    setPending(true);
    timeoutRef.current = setTimeout(() => setPending(false), NAVIGATION_TIMEOUT_MS);
  }

  return (
    <Link {...props} aria-disabled={pending || undefined} onClick={handleClick}>
      {children}
      {pending ? <span className="student-navigation-feedback" role="status">正在加载…</span> : null}
    </Link>
  );
}
