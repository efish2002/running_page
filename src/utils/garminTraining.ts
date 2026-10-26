import trainingFile from '@/static/garmin_training.json';
import {
  AcclimationRecord,
  HrvRecord,
  LoadBalanceRecord,
  ReadinessRecord,
  StatusRecord,
  Vo2Record,
} from '@/components/TrainingStatus/trend';

interface TrainingFile {
  updated_at?: string;
  status?: StatusRecord[];
  hrv?: HrvRecord[];
  readiness?: ReadinessRecord[];
  acclimation?: AcclimationRecord[];
  vo2?: Vo2Record[];
  load_balance?: LoadBalanceRecord[];
}

const file = trainingFile as unknown as TrainingFile;

const list = <T>(value?: T[]): T[] => (Array.isArray(value) ? value : []);

export const trainingStatus: StatusRecord[] = list(file.status);
export const trainingHrv: HrvRecord[] = list(file.hrv);
export const trainingReadiness: ReadinessRecord[] = list(file.readiness);
export const trainingAcclimation: AcclimationRecord[] = list(file.acclimation);
export const trainingVo2: Vo2Record[] = list(file.vo2);
export const trainingLoadBalance: LoadBalanceRecord[] = list(file.load_balance);
export const garminTrainingUpdatedAt: string = file.updated_at ?? '';
