export type MeetingDescriptionPart = {
  type: "text" | "link";
  value: string;
};

export function getMeetingConnectionError(meetingUrl: string, meetingNumber: string): string | null {
  const normalizedUrl = meetingUrl.trim();
  const normalizedNumber = meetingNumber.trim();

  if (!normalizedUrl && !normalizedNumber) return "请填写会议链接或会议号。";
  if (!normalizedUrl) return null;

  try {
    const url = new URL(normalizedUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Unsupported protocol");
  } catch {
    return "请输入有效的会议链接。";
  }

  return null;
}

export function splitMeetingDescription(description: string): MeetingDescriptionPart[] {
  const parts: MeetingDescriptionPart[] = [];
  const linkPattern = /https?:\/\/[^\s<>"']+/giu;
  let cursor = 0;

  for (const match of description.matchAll(linkPattern)) {
    const start = match.index;
    const matchedValue = match[0];
    const trailingPunctuation = matchedValue.match(/[.,!?;:。，！？；：]+$/u)?.[0] ?? "";
    const linkValue = trailingPunctuation
      ? matchedValue.slice(0, -trailingPunctuation.length)
      : matchedValue;

    if (start > cursor) parts.push({ type: "text", value: description.slice(cursor, start) });
    parts.push({ type: "link", value: linkValue });
    if (trailingPunctuation) parts.push({ type: "text", value: trailingPunctuation });
    cursor = start + matchedValue.length;
  }

  if (cursor < description.length) parts.push({ type: "text", value: description.slice(cursor) });
  return parts;
}
