const ROME_TIME_ZONE = "Europe/Rome";

function getParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value ?? 0);

  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

function getTimeZoneOffset(value: Date, timeZone: string) {
  const parts = getParts(value, timeZone);
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  ) - Math.trunc(value.getTime() / 1000) * 1000;
}

function zonedMidnightUtc(year: number, month: number, day: number) {
  const utcGuess = Date.UTC(year, month - 1, day);
  const firstPass = new Date(utcGuess - getTimeZoneOffset(new Date(utcGuess), ROME_TIME_ZONE));
  return new Date(utcGuess - getTimeZoneOffset(firstPass, ROME_TIME_ZONE));
}

export function getRomeDayBounds(now = new Date()) {
  const { year, month, day } = getParts(now, ROME_TIME_ZONE);
  return {
    start: zonedMidnightUtc(year, month, day).toISOString(),
    end: zonedMidnightUtc(year, month, day + 1).toISOString(),
  };
}
