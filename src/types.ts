import type { Timestamp } from 'firebase/firestore';

export type VolumeUnit = 'L' | 'gal';
export type MemberRole = 'manager' | 'worker';
export type PlantCategory = 'vegetable' | 'herb' | 'fruit' | 'orchard' | 'nursery';
export type AnimalType = 'fish' | 'chicken' | 'duck' | 'goat' | 'pig' | 'cattle' | 'other';
export type AnimalTaskKind =
  | 'feeding'
  | 'cleaning'
  | 'water_change'
  | 'egg_collection'
  | 'health_check'
  | 'other';
export type TaskCategory =
  | 'water'
  | 'mulch'
  | 'prune'
  | 'fish_tank'
  | 'animal'
  | 'harvest'
  | 'maintenance';
export type CompletionTaskType = 'water' | 'mulch' | 'prune' | 'fish_tank' | 'animal' | 'custom';
export type ApprovalStatus = 'pending_confirmation' | 'confirmed';
export type TankStage = 1 | 2 | 3;

export const SCHEMA_LIMITS = {
  ID_MAX: 128,
  NAME_MAX: 80,
  DISPLAY_NAME_MAX: 100,
  LOCATION_MAX: 120,
  SPECIALTY_MAX: 100,
  ZONE_MAX: 60,
  HOUSING_MAX: 80,
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

export const ANIMAL_TYPE_LABELS: Record<AnimalType, string> = {
  fish: 'Fish',
  chicken: 'Chickens',
  duck: 'Ducks',
  goat: 'Goats',
  pig: 'Pigs',
  cattle: 'Cattle',
  other: 'Other Animals',
};

export const ANIMAL_TASK_KIND_LABELS: Record<AnimalTaskKind, string> = {
  feeding: 'Feeding',
  cleaning: 'Cleaning',
  water_change: 'Water Refresh',
  egg_collection: 'Egg Collection',
  health_check: 'Health Check',
  other: 'General Care',
};

export interface AnimalTaskPreset {
  title: string;
  taskKind: AnimalTaskKind;
  everyDays: number;
  notes: string;
}

export const ANIMAL_TASK_PRESETS: Record<AnimalType, AnimalTaskPreset[]> = {
  fish: [
    {
      title: 'Feed fish (morning & evening pellets)',
      taskKind: 'feeding',
      everyDays: 1,
      notes: 'Feed floating pellets slowly and stop once fish slow down.',
    },
    {
      title: 'Check aeration pump & water quality',
      taskKind: 'health_check',
      everyDays: 2,
      notes: 'Check water smell, fish swimming activity, and oxygen flow.',
    },
    {
      title: 'Clean intake filter & mesh screen',
      taskKind: 'cleaning',
      everyDays: 7,
      notes: 'Rinse filter mesh to keep drainage pipe clear.',
    },
  ],
  chicken: [
    {
      title: 'Feed chickens & refill clean drinkers',
      taskKind: 'feeding',
      everyDays: 1,
      notes: 'Top up feed troughs and wash waterers with fresh water.',
    },
    {
      title: 'Collect eggs from nesting boxes',
      taskKind: 'egg_collection',
      everyDays: 1,
      notes: 'Collect eggs in morning and late afternoon.',
    },
    {
      title: 'Clean chicken coop & change dry litter',
      taskKind: 'cleaning',
      everyDays: 3,
      notes: 'Remove wet droppings and spread fresh wood shavings or dry straw.',
    },
  ],
  duck: [
    {
      title: 'Feed ducks & top up deep waterers',
      taskKind: 'feeding',
      everyDays: 1,
      notes: 'Ducks need deep water to rinse their bills while eating.',
    },
    {
      title: 'Refresh duck bathing / drinking water',
      taskKind: 'water_change',
      everyDays: 1,
      notes: 'Empty muddy water and refill with fresh clean water.',
    },
    {
      title: 'Clean duck pen & lay dry bedding',
      taskKind: 'cleaning',
      everyDays: 2,
      notes: 'Keep sleeping area dry to protect feet and bedding.',
    },
    {
      title: 'Collect duck eggs',
      taskKind: 'egg_collection',
      everyDays: 1,
      notes: 'Check early morning around nesting corners.',
    },
  ],
  goat: [
    {
      title: 'Feed goats & provide fresh water',
      taskKind: 'feeding',
      everyDays: 1,
      notes: 'Check mineral block and clean water trough.',
    },
    {
      title: 'Sweep goat pen & replace bedding',
      taskKind: 'cleaning',
      everyDays: 3,
      notes: 'Clear manure to compost bay.',
    },
  ],
  pig: [
    {
      title: 'Feed pigs & check drinking nipples',
      taskKind: 'feeding',
      everyDays: 1,
      notes: 'Ensure steady fresh water pressure.',
    },
    {
      title: 'Wash pigsty floor & drainage channel',
      taskKind: 'cleaning',
      everyDays: 2,
      notes: 'Flush waste channel cleanly.',
    },
  ],
  cattle: [
    {
      title: 'Feed cattle & top up water trough',
      taskKind: 'feeding',
      everyDays: 1,
      notes: 'Check hay rack and mineral salt.',
    },
    {
      title: 'Clean barn bedding & check hooves',
      taskKind: 'cleaning',
      everyDays: 3,
      notes: 'Keep resting area dry and clear.',
    },
  ],
  other: [
    {
      title: 'Daily feeding & fresh water',
      taskKind: 'feeding',
      everyDays: 1,
      notes: '',
    },
    {
      title: 'Clean pen & bedding',
      taskKind: 'cleaning',
      everyDays: 3,
      notes: '',
    },
  ],
};

export interface UserProfile {
  uid: string;
  displayName: string;
  activeFarmId: string;
  activeRole: MemberRole;
  activeMemberId: string;
  activeFarmName: string;
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

export interface FarmInvite {
  code: string;
  farmId: string;
  farmName: string;
  ownerId: string;
  memberId: string;
  memberName: string;
  status: 'open' | 'claimed';
  claimedByUid: string;
  initialPlantIds: string[];
  initialTankIds: string[];
  initialAnimalTaskIds: string[];
  initialCustomTaskIds: string[];
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
  inviteCode?: string;
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

export interface AnimalGroup {
  id: string;
  farmId: string;
  ownerId: string;
  name: string;
  animalType: AnimalType;
  count: number;
  housing: string;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AnimalTask {
  id: string;
  farmId: string;
  ownerId: string;
  animalId: string;
  animalName: string;
  animalType: AnimalType;
  taskKind: AnimalTaskKind;
  title: string;
  everyDays: number;
  lastDoneDate: string;
  assigneeId: string;
  assigneeUid: string;
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
  approvalStatus?: ApprovalStatus;
  confirmedByUid?: string;
  confirmedByName?: string;
  waterVolumeLiters: number;
  tankStage: '' | '1/4' | '2/4' | '3/4';
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type ActivityUrgency = 'overdue' | 'due_today' | 'upcoming' | 'pending_confirmation' | 'done';

export interface ScheduledActivity {
  key: string;
  farmArea: 'plants' | 'animals' | 'general';
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
  isPendingConfirmation: boolean;
  completionLog?: CompletionLog;
  animalType?: AnimalType;
  animalTaskKind?: AnimalTaskKind;
  tankStage?: TankStage;
  tankStageLabel?: '1/4' | '2/4' | '3/4';
  waterVolumeLiters?: number;
  linkedPlantIds?: string[];
  linkedPlantNames?: string[];
  receivesFishWater?: boolean;
  cadenceLabel: string;
}

export type ActiveTab = 'today' | 'plants' | 'animals' | 'calendar' | 'team' | 'guide';
