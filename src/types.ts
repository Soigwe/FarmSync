import type { Timestamp } from 'firebase/firestore';

export type VolumeUnit = 'L' | 'gal';
export type MemberRole = 'manager' | 'worker';
export type PlantCategory = 'vegetable' | 'herb' | 'fruit' | 'orchard' | 'nursery';
export type TaskCategory = 'water' | 'mulch' | 'prune' | 'fish_tank' | 'harvest' | 'maintenance';
export type CompletionTaskType = 'water' | 'mulch' | 'prune' | 'fish_tank' | 'custom';
export type TankStage = 1 | 2 | 3;

export const SCHEMA_LIMITS = {
  ID_MAX: 128,
  NAME_MAX: 80,
  DISPLAY_NAME_MAX: 100,
  LOCATION_MAX: 120,
  SPECIALTY_MAX: 100,
  ZONE_MAX: 60,
  TITLE_MAX: 120,
  NOTES_MAX: 400,
  COMPLETION_NOTES_MAX: 300,
  MAX_IRRIGATION_BEDS: 10,
  WATER_DAYS_MIN: 1,
  WATER_DAYS_MAX: 60,
  CARE_DAYS_MIN: 1,
  CARE_DAYS_MAX: 180,
  TANK_CAPACITY_MIN: 50,
  TANK_CAPACITY_MAX: 500000,
  TANK_INTERVAL_MIN: 1,
  TANK_INTERVAL_MAX: 14,
  RECURRENCE_MAX: 365,
} as const;

export interface UserProfile {
  uid: string;
  displayName: string;
  activeFarmId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Farm {
  id: string;
  ownerId: string;
  name: string;
  location: string;
  volumeUnit: VolumeUnit;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface FarmMember {
  id: string;
  farmId: string;
  ownerId: string;
  name: string;
  role: MemberRole;
  specialty: string;
  linkedUid: string;
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PlantSchedule {
  id: string;
  farmId: string;
  ownerId: string;
  name: string;
  zone: string;
  category: PlantCategory;
  waterEnabled: boolean;
  waterEveryDays: number;
  lastWateredDate: string;
  waterAssigneeId: string;
  waterAssigneeUid: string;
  mulchEnabled: boolean;
  mulchEveryDays: number;
  lastMulchedDate: string;
  mulchAssigneeId: string;
  mulchAssigneeUid: string;
  pruneEnabled: boolean;
  pruneEveryDays: number;
  lastPrunedDate: string;
  pruneAssigneeId: string;
  pruneAssigneeUid: string;
  receivesFishWater: boolean;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface FishTank {
  id: string;
  farmId: string;
  ownerId: string;
  name: string;
  species: string;
  capacityLiters: number;
  intervalDays: number;
  currentStage: TankStage;
  nextDrawdownDate: string;
  lastDrawdownDate: string;
  assigneeId: string;
  assigneeUid: string;
  irrigationBedIds: string[];
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CustomTask {
  id: string;
  farmId: string;
  ownerId: string;
  title: string;
  category: TaskCategory;
  dueDate: string;
  recurrenceDays: number;
  assigneeId: string;
  assigneeUid: string;
  status: 'pending' | 'completed';
  completedDate: string;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CompletionLog {
  id: string;
  farmId: string;
  ownerId: string;
  dateKey: string;
  taskType: CompletionTaskType;
  sourceId: string;
  sourceTitle: string;
  assignedMemberId: string;
  assignedMemberName: string;
  assignedUid: string;
  completedByUid: string;
  completedByName: string;
  status: 'done';
  waterVolumeLiters: number;
  tankStage: '' | '1/4' | '2/4' | '3/4';
  notes: string;
  createdAt?: Timestamp;
}

export type ActivityUrgency = 'overdue' | 'due_today' | 'upcoming' | 'done';

export interface ScheduledActivity {
  key: string;
  taskType: CompletionTaskType;
  sourceId: string;
  title: string;
  subtitle: string;
  zoneOrDetail: string;
  dueDate: string;
  daysOverdue: number;
  urgency: ActivityUrgency;
  assigneeId: string;
  assigneeName: string;
  assigneeUid: string;
  isDoneForDay: boolean;
  completionLog?: CompletionLog;
  // Fish tank metadata when taskType === 'fish_tank'
  tankStage?: TankStage;
  tankStageLabel?: '1/4' | '2/4' | '3/4';
  waterVolumeLiters?: number;
  linkedPlantIds?: string[];
  linkedPlantNames?: string[];
  receivesFishWater?: boolean;
  cadenceLabel: string;
}

export type ActiveTab = 'today' | 'fish_tanks' | 'plants' | 'calendar' | 'team';
