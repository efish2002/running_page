import { useEffect, useState } from 'react';
import visitSnapshotFile from '@/static/visits.json';
import {
  VisitDay,
  VISIT_COUNTER_KEY,
  dailyVisitKey,
  mergeVisitDays,
  parseCounterValue,
  readVisitSnapshot,
  utcDate,
  visitCounterUrl,
} from '@/utils/visits';

export interface VisitCounterState {
  total: number;
  today: number;
  days: VisitDay[];
  updatedAt: string;
  live: boolean;
}

interface LiveVisits {
  total: number | null;
  today: number | null;
}

const snapshot = readVisitSnapshot(visitSnapshotFile);

// the counter counts one visit per page load, the promise keeps a route
// change from counting the same visitor twice
let pending: Promise<LiveVisits> | null = null;

const postHit = async (key: string): Promise<number | null> => {
  try {
    const response = await fetch(visitCounterUrl('hit', key), {
      method: 'POST',
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return parseCounterValue(await response.json());
  } catch {
    return null;
  }
};

const registerVisit = (): Promise<LiveVisits> => {
  if (!pending) {
    const today = utcDate();

    pending = Promise.all([
      postHit(VISIT_COUNTER_KEY),
      postHit(dailyVisitKey(today)),
    ]).then(([total, todayCount]) => ({ total, today: todayCount }));
  }

  return pending;
};

const useVisitCounter = (): VisitCounterState => {
  const [live, setLive] = useState<LiveVisits>({ total: null, today: null });

  useEffect(() => {
    let active = true;

    registerVisit().then((result) => {
      if (active) {
        setLive(result);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const days = mergeVisitDays([
    ...snapshot.days,
    ...(live.today !== null ? [{ date: utcDate(), count: live.today }] : []),
  ]);
  const bakedToday = snapshot.days[snapshot.days.length - 1];

  return {
    total: live.total ?? snapshot.total,
    today: live.today ?? bakedToday?.count ?? 0,
    days,
    updatedAt: snapshot.updatedAt,
    live: live.total !== null,
  };
};

export default useVisitCounter;
