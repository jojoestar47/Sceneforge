// Shared formatting helpers. Keep this file tiny — pure functions only.

/** Short human date: "Jan 5, 2026". */
export function formatDate(str: string): string {
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
  })
}
