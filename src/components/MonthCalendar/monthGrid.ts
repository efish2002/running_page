export interface MonthGridRun {
  start_date_local: string;
  distance: number;
}

export interface MonthCell<T = MonthGridRun> {
  // null marks a padding cell, either before the first or after the last day
  day: number | null;
  distance: number;
  runs: T[];
}

const WEEKS = 6;

const emptyCell = <T>(): MonthCell<T> => ({ day: null, distance: 0, runs: [] });

/**
 * Builds the six week grid of a month, Sunday first.
 * Every day carries the distance and the runs recorded on it.
 */
export const buildMonthGrid = <T extends MonthGridRun>(
  year: number,
  month: number,
  runs: T[]
): MonthCell<T>[] => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: MonthCell<T>[] = [];

  for (let i = 0; i < new Date(year, month, 1).getDay(); i++) {
    cells.push(emptyCell());
  }

  const byDay = new Map<number, T[]>();
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
