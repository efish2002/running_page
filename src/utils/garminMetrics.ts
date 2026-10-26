import metricsFile from '@/static/garmin_metrics.json';
import { MetricLike } from '@/components/PhysiologyTrends/trend';

interface MetricsFile {
  updated_at?: string;
  activities?: MetricLike[];
}

const file = metricsFile as unknown as MetricsFile;

export const garminMetrics: MetricLike[] = Array.isArray(file.activities)
  ? file.activities
  : [];

export const garminMetricsUpdatedAt: string = file.updated_at ?? '';
