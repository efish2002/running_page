export interface SelectableRun {
  run_id: number;
}

// ids may point at activities outside the currently filtered set (e.g. a day
// picked in the calendar while the map shows another year), so the full
// activity list is the lookup source
export const selectRunsByIds = <T extends SelectableRun>(
  activities: T[],
  runs: T[],
  runIds: Array<number>
): T[] => {
  if (!runIds.length) {
    return runs;
  }
  const ids = new Set(runIds);
  return activities.filter((run) => ids.has(run.run_id));
};
