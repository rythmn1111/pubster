/**
 * Small formatting helpers.
 *
 * The backend treats opening-hours wall-clock times and the reservation `date`
 * query param as **UTC** for the MVP (see docs/ROADMAP.md — timezone
 * assumption). To stay consistent with slot generation we compute "today" and
 * render slot times in UTC.
 */

/** Today's date as `YYYY-MM-DD` in UTC (matches the backend's date handling). */
export function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Render an ISO-8601 timestamp as `HH:MM` in UTC. */
export function formatTimeUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Render an ISO-8601 date (`YYYY-MM-DD`) as a friendly UTC label. */
export function formatDateLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
