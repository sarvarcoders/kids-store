import { z } from "zod";

export function getTashkentDayRange(
  nowInput: unknown = new Date(),
): { end: Date; start: Date } {
  const now = z.date().parse(nowInput);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;

    return z.coerce.number().int().parse(value);
  };
  const startMilliseconds =
    Date.UTC(read("year"), read("month") - 1, read("day")) -
    5 * 60 * 60 * 1_000;

  return {
    start: new Date(startMilliseconds),
    end: new Date(startMilliseconds + 24 * 60 * 60 * 1_000),
  };
}
