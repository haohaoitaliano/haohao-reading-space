"use client";

import { useEffect } from "react";

export function AudioPlaybackCoordinator() {
  useEffect(() => {
    function pauseOtherAudio(event: Event) {
      const current = event.target;
      if (!(current instanceof HTMLAudioElement)) return;
      document.querySelectorAll("audio").forEach((audio) => {
        if (audio !== current && !audio.paused) audio.pause();
      });
    }

    document.addEventListener("play", pauseOtherAudio, true);
    return () => document.removeEventListener("play", pauseOtherAudio, true);
  }, []);

  return null;
}
