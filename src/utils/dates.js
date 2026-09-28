// Date helpers that always work in the user's LOCAL timezone.
//
// Why this file exists: `new Date().toISOString().slice(0, 10)` returns the
// UTC date, not the local one. In Korea (UTC+9) that means anything done
// between midnight and 9am was stamped with *yesterday's* date. And
// `new Date("2026-09-01")` is parsed as UTC midnight, which in negative-offset
// timezones lands on the previous day (and sometimes the previous month).

function pad(n) {
  return String(n).padStart(2, "0");
}

// Date -> "YYYY-MM-DD" in local time.
export function toLocalISODate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayLocal() {
  return toLocalISODate(new Date());
}

// "YYYY-MM-DD" -> Date at LOCAL midnight. Falls back to the normal
// Date parser for anything else (e.g. full ISO timestamps).
export function parseLocalDate(value) {
  if (typeof value === "string") {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(value);
}
