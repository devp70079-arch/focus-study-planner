/**
 * Local-timezone calendar date helpers (avoids UTC off-by-one-day shifts in evening hours).
 */

export function getLocalDateString(offsetDays = 0, baseDate: Date = new Date()): string {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalDateFromISO(isoString: string): string {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return isoString.split('T')[0] || getLocalDateString();
  }
  return getLocalDateString(0, parsed);
}
