export interface Change {
  current: number;
  previous: number;
  delta: number;
  pct: number | null; // null when there is no previous value to compare with
}

export const change = (current: number, previous: number): Change => ({
  current,
  previous,
  delta: current - previous,
  pct: previous === 0 ? null : (current - previous) / Math.abs(previous),
});
