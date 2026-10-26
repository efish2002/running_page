export interface MonthGridRun {
  start_date_local: string;
  distance: number;
}

export interface MonthCell {
  // null marks a padding cell, either before the first or after the last day
  day: number | null;
  distance: number;
  runs: MonthGridRun[];
}

const WEEKS = 6;

const emptyCell = (): MonthCell => ({ day: null, distance: 0, runs: [] });

/**
 * Builds the six week grid of a month, Sunday first.
 * Every day carries the distance and the runs recorded on it.
 */
export const buildMonthGrid = (
  year: number,
  month: number,
  runs: MonthGridRun[]
): MonthCell[] => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: MonthCell[] = [];

  for (let i = 0; i < new Date(year, month, 1).getDay(); i++) {
    cells.push(emptyCell());
  }

  const byDay = new Map<number, MonthGridRun[]>();
  for (const run of runs) {
    if (!run?.start_date_local) {
      continue;
    }
    const date = new Date(run.start_date_local.replace(' ', 'T'));
    if (date.getFullYear() !== year || date.getMonth() !== month) {
      continue;
    }
    const day = date.getDate();
    const dayRuns = byDay.get(day);
    if (dayRuns) {
      dayRuns.push(run);
    } else {
      byDay.set(day, [run]);
    }
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayRuns = byDay.get(day) ?? [];
    cells.push({
      day,
      distance: dayRuns.reduce((sum, run) => sum + (run.distance || 0), 0),
      runs: dayRuns,
    });
  }

  while (cells.length < WEEKS * 7) {
    cells.push(emptyCell());
  }

  return cells;
};
