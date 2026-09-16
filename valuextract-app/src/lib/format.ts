/**
 * Date formatting shared by server and client rendering.
 *
 * Deliberately hand-rolled rather than `Intl.DateTimeFormat`: ICU data differs
 * between the Node server and the browser (Node renders September as "Sept",
 * Chrome as "Sep"), and any such difference makes React discard the hydrated
 * tree. A fixed month table and a fixed offset give byte-identical output
 * everywhere.
 *
 * South African Standard Time has no daylight saving, so a constant +02:00
 * offset is exact rather than an approximation. Change both constants together
 * if the application is ever deployed for another region.
 */
export const REPORT_TIME_ZONE = "Africa/Johannesburg";
const OFFSET_MINUTES = 2 * 60;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

type Parts = {
  day: number;
  month: number;
  year: number;
  hour: number;
  minute: number;
  second: number;
};

function parts(value: string | null | undefined): Parts | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const shifted = new Date(date.getTime() + OFFSET_MINUTES * 60_000);
  return {
    day: shifted.getUTCDate(),
    month: shifted.getUTCMonth(),
    year: shifted.getUTCFullYear(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDate(value: string | null | undefined): string {
  const p = parts(value);
  return p ? `${pad(p.day)} ${MONTHS[p.month]} ${p.year}` : "—";
}

export function formatDateTime(value: string | null | undefined): string {
  const p = parts(value);
  return p
    ? `${pad(p.day)} ${MONTHS[p.month]} ${p.year}, ${pad(p.hour)}:${pad(p.minute)}`
    : "—";
}

export function formatTime(value: string | null | undefined): string {
  const p = parts(value);
  return p ? `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}` : "—";
}
