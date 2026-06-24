const DEFAULT_CAMP_TIME_ZONE = "Europe/Rome";

export function normalizeCampTimeZone(timeZone: string | null | undefined) {
  if (!timeZone) return DEFAULT_CAMP_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
    return timeZone;
  } catch {
    return DEFAULT_CAMP_TIME_ZONE;
  }
}

export function formatDateTimeLocalInZone(value: string | null, timeZone: string) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: normalizeCampTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function formatUnlockDateTime(value: string | null, timeZone: string) {
  if (!value) return "训练营开始时间尚未设置";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: normalizeCampTimeZone(timeZone),
  }).format(new Date(value));
}
