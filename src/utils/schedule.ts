import {
  ANIMAL_TASK_KIND_LABELS,
  ANIMAL_TYPE_LABELS,
  AnimalTask,
  CompletionLog,
  CustomTask,
  FarmMember,
  FishTank,
  PlantSchedule,
  SCHEMA_LIMITS,
  ScheduledActivity,
  TankStage,
  VolumeUnit,
} from '../types';

const ID_CLEAN_REGEX = /[^a-zA-Z0-9_-]/g;

export function sanitizeId(raw: string): string {
  return raw.replace(ID_CLEAN_REGEX, '').slice(0, SCHEMA_LIMITS.ID_MAX);
}

export function sanitizeInviteCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function generateDocId(prefix: string): string {
  const cleanPrefix = sanitizeId(prefix) || 'doc';
  const rand = Math.random().toString(36).slice(2, 8);
  return `${cleanPrefix}_${Date.now().toString(36)}_${rand}`;
}

export function clampString(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export function clampInt(value: number, min: number, max: number): number {
  const rounded = Math.round(Number.isFinite(value) ? value : min);
  return Math.max(min, Math.min(max, rounded));
}

export function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(dateKey: string, days: number): string {
  const d = parseDateKey(dateKey);
  d.setDate(d.getDate() + days);
  return formatDateKey(d);
}

export function diffDays(fromDateKey: string, toDateKey: string): number {
  const a = parseDateKey(fromDateKey);
  const b = parseDateKey(toDateKey);
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function formatReadableDate(dateKey: string): string {
  if (!dateKey) return 'Not yet logged';
  const d = parseDateKey(dateKey);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatShortDay(dateKey: string): { weekday: string; dayNum: string; month: string } {
  const d = parseDateKey(dateKey);
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    dayNum: String(d.getDate()),
    month: d.toLocaleDateString('en-US', { month: 'short' }),
  };
}

export function stageToLabel(stage: TankStage): '1/4' | '2/4' | '3/4' {
  if (stage === 1) return '1/4';
  if (stage === 2) return '2/4';
  return '3/4';
}

export function nextTankStage(stage: TankStage): TankStage {
  if (stage === 1) return 2;
  if (stage === 2) return 3;
  return 1;
}

export function getStageDischargeLiters(capacityLiters: number, stage: TankStage): number {
  return Math.round((capacityLiters * stage) / 4);
}

export function getRemainingFractionAfterStage(stage: TankStage): number {
  return (4 - stage) / 4;
}

export function formatVolume(liters: number, unit: VolumeUnit): string {
  if (unit === 'gal') {
    const gallons = Math.round(liters * 0.264172);
    return `${gallons.toLocaleString()} gal`;
  }
  return `${Math.round(liters).toLocaleString()} L`;
}

export function getNextCareDueDate(lastDate: string, everyDays: number, fallbackToday: string): string {
  if (!lastDate) return fallbackToday;
  return addDays(lastDate, everyDays);
}

export function getMemberName(members: FarmMember[], memberId: string): string {
  if (!memberId) return 'Unassigned';
  const found = members.find((m) => m.id === memberId);
  return found ? found.name : 'Unassigned';
}

export function isCompletionConfirmed(log?: CompletionLog): boolean {
  if (!log) return false;
  return (log.approvalStatus ?? 'confirmed') === 'confirmed';
}

export function isCompletionPending(log?: CompletionLog): boolean {
  if (!log) return false;
  return log.approvalStatus === 'pending_confirmation';
}

export function buildDailySchedule(params: {
  selectedDate: string;
  todayDate: string;
  plants: PlantSchedule[];
  fishTanks: FishTank[];
  animalTasks: AnimalTask[];
  tasks: CustomTask[];
  members: FarmMember[];
  completions: CompletionLog[];
  volumeUnit: VolumeUnit;
}): ScheduledActivity[] {
  const {
    selectedDate,
    todayDate,
    plants,
    fishTanks,
    animalTasks,
    tasks,
    members,
    completions,
    volumeUnit,
  } = params;
  const activities: ScheduledActivity[] = [];
  const isViewingTodayOrPast = selectedDate <= todayDate;

  const findCompletion = (taskType: CompletionLog['taskType'], sourceId: string) =>
    completions.find(
      (c) => c.dateKey === selectedDate && c.taskType === taskType && c.sourceId === sourceId
    );

  // 1. Fish Tank Water Change Activities (1/4 -> 2/4 -> 3/4 every 2 days)
  for (const tank of fishTanks) {
    const comp = findCompletion('fish_tank', tank.id);
    const linkedPlantNames = tank.irrigationBedIds
      .map((pid) => plants.find((p) => p.id === pid)?.name)
      .filter((n): n is string => Boolean(n));

    if (comp) {
      const stageNum: TankStage = comp.tankStage === '3/4' ? 3 : comp.tankStage === '2/4' ? 2 : 1;
      const pending = isCompletionPending(comp);
      activities.push({
        key: `fish_tank:${tank.id}:${selectedDate}`,
        farmArea: 'animals',
        taskType: 'fish_tank',
        sourceId: tank.id,
        title: `${tank.name} — drain ${comp.tankStage || stageToLabel(tank.currentStage)} water`,
        subtitle: `Route ${formatVolume(comp.waterVolumeLiters, volumeUnit)} to ${
          linkedPlantNames.length > 0 ? linkedPlantNames.join(', ') : 'crop beds'
        }`,
        zoneOrDetail: `Fish · ${tank.species}`,
        dueDate: selectedDate,
        daysOverdue: 0,
        urgency: pending ? 'pending_confirmation' : 'done',
        assigneeId: tank.assigneeId,
        assigneeName: comp.assignedMemberName || getMemberName(members, tank.assigneeId),
        assigneeUid: tank.assigneeUid,
        isDoneForDay: !pending,
        isPendingConfirmation: pending,
        completionLog: comp,
        animalType: 'fish',
        tankStage: stageNum,
        tankStageLabel: comp.tankStage || stageToLabel(tank.currentStage),
        waterVolumeLiters: comp.waterVolumeLiters,
        linkedPlantIds: tank.irrigationBedIds,
        linkedPlantNames,
        cadenceLabel: `Every ${tank.intervalDays}d`,
      });
      continue;
    }

    const delta = diffDays(tank.nextDrawdownDate, selectedDate);
    let projectedStage: TankStage | null = null;
    let effectiveDueDate = tank.nextDrawdownDate;

    if (isViewingTodayOrPast && delta >= 0) {
      projectedStage = tank.currentStage;
      effectiveDueDate = tank.nextDrawdownDate;
    } else if (!isViewingTodayOrPast && delta >= 0 && delta % tank.intervalDays === 0) {
      const stepsAhead = Math.floor(delta / tank.intervalDays);
      const rawStage = ((tank.currentStage - 1 + stepsAhead) % 3) + 1;
      projectedStage = rawStage as TankStage;
      effectiveDueDate = selectedDate;
    }

    if (projectedStage !== null) {
      const stageLabel = stageToLabel(projectedStage);
      const dischargeLiters = getStageDischargeLiters(tank.capacityLiters, projectedStage);
      const overdueDays = Math.max(0, diffDays(effectiveDueDate, selectedDate));
      const refillNote = projectedStage === 3 ? ' + refill fresh water' : '';
      activities.push({
        key: `fish_tank:${tank.id}:${selectedDate}`,
        farmArea: 'animals',
        taskType: 'fish_tank',
        sourceId: tank.id,
        title: `${tank.name} — drain ${stageLabel}${refillNote}`,
        subtitle: `Use ${formatVolume(dischargeLiters, volumeUnit)} for irrigation → ${
          linkedPlantNames.length > 0 ? linkedPlantNames.join(', ') : 'crop beds'
        }`,
        zoneOrDetail: `Fish · ${tank.species}`,
        dueDate: effectiveDueDate,
        daysOverdue: overdueDays,
        urgency: overdueDays > 0 ? 'overdue' : selectedDate === todayDate ? 'due_today' : 'upcoming',
        assigneeId: tank.assigneeId,
        assigneeName: getMemberName(members, tank.assigneeId),
        assigneeUid: tank.assigneeUid,
        isDoneForDay: false,
        isPendingConfirmation: false,
        animalType: 'fish',
        tankStage: projectedStage,
        tankStageLabel: stageLabel,
        waterVolumeLiters: dischargeLiters,
        linkedPlantIds: tank.irrigationBedIds,
        linkedPlantNames,
        cadenceLabel: `Every ${tank.intervalDays}d (${stageLabel})`,
      });
    }
  }

  // 2. Animal Farm Care Tasks (Feeding Catfish, Feeding/Cleaning Chickens & Ducks, etc.)
  for (const aTask of animalTasks) {
    const comp = findCompletion('animal', aTask.id);
    const typeText = ANIMAL_TYPE_LABELS[aTask.animalType] || 'Animals';
    const kindText = ANIMAL_TASK_KIND_LABELS[aTask.taskKind] || 'Care';

    if (comp) {
      const pending = isCompletionPending(comp);
      activities.push({
        key: `animal:${aTask.id}:${selectedDate}`,
        farmArea: 'animals',
        taskType: 'animal',
        sourceId: aTask.id,
        title: `${aTask.title} — ${aTask.animalName}`,
        subtitle: comp.notes || aTask.notes || `${typeText} ${kindText.toLowerCase()}`,
        zoneOrDetail: `${typeText} · ${kindText}`,
        dueDate: selectedDate,
        daysOverdue: 0,
        urgency: pending ? 'pending_confirmation' : 'done',
        assigneeId: aTask.assigneeId,
        assigneeName: comp.assignedMemberName || getMemberName(members, aTask.assigneeId),
        assigneeUid: aTask.assigneeUid,
        isDoneForDay: !pending,
        isPendingConfirmation: pending,
        completionLog: comp,
        animalType: aTask.animalType,
        animalTaskKind: aTask.taskKind,
        cadenceLabel: aTask.everyDays === 1 ? 'Daily' : `Every ${aTask.everyDays}d`,
      });
      continue;
    }

    const nextDue = getNextCareDueDate(aTask.lastDoneDate, aTask.everyDays, todayDate);
    const delta = diffDays(nextDue, selectedDate);
    const isDueOnSelected =
      (isViewingTodayOrPast && delta >= 0) ||
      (!isViewingTodayOrPast && delta >= 0 && delta % aTask.everyDays === 0);

    if (isDueOnSelected) {
      const effectiveDue = isViewingTodayOrPast ? nextDue : selectedDate;
      const overdueDays = Math.max(0, diffDays(effectiveDue, selectedDate));
      activities.push({
        key: `animal:${aTask.id}:${selectedDate}`,
        farmArea: 'animals',
        taskType: 'animal',
        sourceId: aTask.id,
        title: `${aTask.title} — ${aTask.animalName}`,
        subtitle: aTask.notes || `${typeText} ${kindText.toLowerCase()}`,
        zoneOrDetail: `${typeText} · ${kindText}`,
        dueDate: effectiveDue,
        daysOverdue: overdueDays,
        urgency: overdueDays > 0 ? 'overdue' : selectedDate === todayDate ? 'due_today' : 'upcoming',
        assigneeId: aTask.assigneeId,
        assigneeName: getMemberName(members, aTask.assigneeId),
        assigneeUid: aTask.assigneeUid,
        isDoneForDay: false,
        isPendingConfirmation: false,
        animalType: aTask.animalType,
        animalTaskKind: aTask.taskKind,
        cadenceLabel: aTask.everyDays === 1 ? 'Daily' : `Every ${aTask.everyDays}d`,
      });
    }
  }

  // 3. Plant Care Activities (Watering, Mulching, Pruning)
  for (const plant of plants) {
    const careConfigs: Array<{
      enabled: boolean;
      taskType: 'water' | 'mulch' | 'prune';
      everyDays: number;
      lastDate: string;
      assigneeId: string;
      assigneeUid: string;
      verb: string;
      detail: string;
    }> = [
      {
        enabled: plant.waterEnabled,
        taskType: 'water',
        everyDays: plant.waterEveryDays,
        lastDate: plant.lastWateredDate,
        assigneeId: plant.waterAssigneeId,
        assigneeUid: plant.waterAssigneeUid,
        verb: 'Water',
        detail: plant.receivesFishWater ? 'Can use fish tank water' : 'Fresh water',
      },
      {
        enabled: plant.mulchEnabled,
        taskType: 'mulch',
        everyDays: plant.mulchEveryDays,
        lastDate: plant.lastMulchedDate,
        assigneeId: plant.mulchAssigneeId,
        assigneeUid: plant.mulchAssigneeUid,
        verb: 'Add mulch to',
        detail: 'Spread straw or organic mulch around roots',
      },
      {
        enabled: plant.pruneEnabled,
        taskType: 'prune',
        everyDays: plant.pruneEveryDays,
        lastDate: plant.lastPrunedDate,
        assigneeId: plant.pruneAssigneeId,
        assigneeUid: plant.pruneAssigneeUid,
        verb: 'Prune',
        detail: 'Trim side shoots & dry leaves',
      },
    ];

    for (const cfg of careConfigs) {
      if (!cfg.enabled) continue;
      const comp = findCompletion(cfg.taskType, plant.id);
      if (comp) {
        const pending = isCompletionPending(comp);
        activities.push({
          key: `${cfg.taskType}:${plant.id}:${selectedDate}`,
          farmArea: 'plants',
          taskType: cfg.taskType,
          sourceId: plant.id,
          title: `${cfg.verb} ${plant.name}`,
          subtitle: comp.notes || cfg.detail,
          zoneOrDetail: `Plants · ${plant.zone}`,
          dueDate: selectedDate,
          daysOverdue: 0,
          urgency: pending ? 'pending_confirmation' : 'done',
          assigneeId: cfg.assigneeId,
          assigneeName: comp.assignedMemberName || getMemberName(members, cfg.assigneeId),
          assigneeUid: cfg.assigneeUid,
          isDoneForDay: !pending,
          isPendingConfirmation: pending,
          completionLog: comp,
          receivesFishWater: plant.receivesFishWater,
          cadenceLabel: cfg.everyDays === 1 ? 'Daily' : `Every ${cfg.everyDays}d`,
        });
        continue;
      }

      const nextDue = getNextCareDueDate(cfg.lastDate, cfg.everyDays, todayDate);
      const delta = diffDays(nextDue, selectedDate);
      const isDueOnSelected =
        (isViewingTodayOrPast && delta >= 0) ||
        (!isViewingTodayOrPast && delta >= 0 && delta % cfg.everyDays === 0);

      if (isDueOnSelected) {
        const effectiveDue = isViewingTodayOrPast ? nextDue : selectedDate;
        const overdueDays = Math.max(0, diffDays(effectiveDue, selectedDate));
        activities.push({
          key: `${cfg.taskType}:${plant.id}:${selectedDate}`,
          farmArea: 'plants',
          taskType: cfg.taskType,
          sourceId: plant.id,
          title: `${cfg.verb} ${plant.name}`,
          subtitle: cfg.detail,
          zoneOrDetail: `Plants · ${plant.zone}`,
          dueDate: effectiveDue,
          daysOverdue: overdueDays,
          urgency: overdueDays > 0 ? 'overdue' : selectedDate === todayDate ? 'due_today' : 'upcoming',
          assigneeId: cfg.assigneeId,
          assigneeName: getMemberName(members, cfg.assigneeId),
          assigneeUid: cfg.assigneeUid,
          isDoneForDay: false,
          isPendingConfirmation: false,
          receivesFishWater: plant.receivesFishWater,
          cadenceLabel: cfg.everyDays === 1 ? 'Daily' : `Every ${cfg.everyDays}d`,
        });
      }
    }
  }

  // 4. Custom Tasks
  for (const task of tasks) {
    const comp = findCompletion('custom', task.id);
    const area: ScheduledActivity['farmArea'] =
      task.category === 'fish_tank' || task.category === 'animal'
        ? 'animals'
        : task.category === 'water' || task.category === 'mulch' || task.category === 'prune'
          ? 'plants'
          : 'general';

    if (comp) {
      const pending = isCompletionPending(comp);
      activities.push({
        key: `custom:${task.id}:${selectedDate}`,
        farmArea: area,
        taskType: 'custom',
        sourceId: task.id,
        title: task.title,
        subtitle: comp.notes || task.notes || 'Custom farm task',
        zoneOrDetail: task.category.replace('_', ' '),
        dueDate: selectedDate,
        daysOverdue: 0,
        urgency: pending ? 'pending_confirmation' : 'done',
        assigneeId: task.assigneeId,
        assigneeName: comp.assignedMemberName || getMemberName(members, task.assigneeId),
        assigneeUid: task.assigneeUid,
        isDoneForDay: !pending,
        isPendingConfirmation: pending,
        completionLog: comp,
        cadenceLabel: task.recurrenceDays > 0 ? `Every ${task.recurrenceDays}d` : 'One-time',
      });
      continue;
    }

    if (task.status === 'completed' && task.recurrenceDays === 0) continue;

    const delta = diffDays(task.dueDate, selectedDate);
    const isDue =
      (isViewingTodayOrPast && delta >= 0) ||
      (!isViewingTodayOrPast &&
        (delta === 0 || (task.recurrenceDays > 0 && delta > 0 && delta % task.recurrenceDays === 0)));

    if (isDue) {
      const effectiveDue = isViewingTodayOrPast ? task.dueDate : selectedDate;
      const overdueDays = Math.max(0, diffDays(effectiveDue, selectedDate));
      activities.push({
        key: `custom:${task.id}:${selectedDate}`,
        farmArea: area,
        taskType: 'custom',
        sourceId: task.id,
        title: task.title,
        subtitle: task.notes || 'Custom farm task',
        zoneOrDetail: task.category.replace('_', ' '),
        dueDate: effectiveDue,
        daysOverdue: overdueDays,
        urgency: overdueDays > 0 ? 'overdue' : selectedDate === todayDate ? 'due_today' : 'upcoming',
        assigneeId: task.assigneeId,
        assigneeName: getMemberName(members, task.assigneeId),
        assigneeUid: task.assigneeUid,
        isDoneForDay: false,
        isPendingConfirmation: false,
        cadenceLabel: task.recurrenceDays > 0 ? `Every ${task.recurrenceDays}d` : 'One-time',
      });
    }
  }

  const urgencyRank: Record<ScheduledActivity['urgency'], number> = {
    pending_confirmation: 0,
    overdue: 1,
    due_today: 2,
    upcoming: 3,
    done: 4,
  };
  const typeRank: Record<ScheduledActivity['taskType'], number> = {
    fish_tank: 0,
    animal: 1,
    water: 2,
    mulch: 3,
    prune: 4,
    custom: 5,
  };

  return activities.sort((a, b) => {
    if (urgencyRank[a.urgency] !== urgencyRank[b.urgency]) {
      return urgencyRank[a.urgency] - urgencyRank[b.urgency];
    }
    if (b.daysOverdue !== a.daysOverdue) {
      return b.daysOverdue - a.daysOverdue;
    }
    if (typeRank[a.taskType] !== typeRank[b.taskType]) {
      return typeRank[a.taskType] - typeRank[b.taskType];
    }
    return a.title.localeCompare(b.title);
  });
}

export interface TankProjectionRow {
  dateKey: string;
  stage: TankStage;
  stageLabel: '1/4' | '2/4' | '3/4';
  dischargeLiters: number;
  remainingPercent: number;
  includesRefill: boolean;
}

export function buildTankForecast(tank: FishTank, count = 6): TankProjectionRow[] {
  const rows: TankProjectionRow[] = [];
  let dateKey = tank.nextDrawdownDate;
  let stage: TankStage = tank.currentStage;

  for (let i = 0; i < count; i++) {
    rows.push({
      dateKey,
      stage,
      stageLabel: stageToLabel(stage),
      dischargeLiters: getStageDischargeLiters(tank.capacityLiters, stage),
      remainingPercent: Math.round(getRemainingFractionAfterStage(stage) * 100),
      includesRefill: stage === 3,
    });
    dateKey = addDays(dateKey, tank.intervalDays);
    stage = nextTankStage(stage);
  }
  return rows;
}
