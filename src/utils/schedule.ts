import {
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

export function buildDailySchedule(params: {
  selectedDate: string;
  todayDate: string;
  plants: PlantSchedule[];
  fishTanks: FishTank[];
  tasks: CustomTask[];
  members: FarmMember[];
  completions: CompletionLog[];
  volumeUnit: VolumeUnit;
}): ScheduledActivity[] {
  const { selectedDate, todayDate, plants, fishTanks, tasks, members, completions, volumeUnit } = params;
  const activities: ScheduledActivity[] = [];
  const isViewingTodayOrPast = selectedDate <= todayDate;

  const findCompletion = (taskType: CompletionLog['taskType'], sourceId: string) =>
    completions.find(
      (c) => c.dateKey === selectedDate && c.taskType === taskType && c.sourceId === sourceId
    );

  // 1. Fish Tank Drawdown Activities (1/4 -> 2/4 -> 3/4 every 2 days)
  for (const tank of fishTanks) {
    const comp = findCompletion('fish_tank', tank.id);
    const linkedPlantNames = tank.irrigationBedIds
      .map((pid) => plants.find((p) => p.id === pid)?.name)
      .filter((n): n is string => Boolean(n));

    if (comp) {
      const stageNum: TankStage = comp.tankStage === '3/4' ? 3 : comp.tankStage === '2/4' ? 2 : 1;
      activities.push({
        key: `fish_tank:${tank.id}:${selectedDate}`,
        taskType: 'fish_tank',
        sourceId: tank.id,
        title: `${tank.name} — ${comp.tankStage || stageToLabel(tank.currentStage)} drawdown`,
        subtitle: `Irrigated ${linkedPlantNames.length > 0 ? linkedPlantNames.join(', ') : 'crop beds'} with ${formatVolume(comp.waterVolumeLiters, volumeUnit)} effluent`,
        zoneOrDetail: `${tank.species} · ${formatVolume(tank.capacityLiters, volumeUnit)} tank`,
        dueDate: selectedDate,
        daysOverdue: 0,
        urgency: 'done',
        assigneeId: tank.assigneeId,
        assigneeName: comp.assignedMemberName || getMemberName(members, tank.assigneeId),
        assigneeUid: tank.assigneeUid,
        isDoneForDay: true,
        completionLog: comp,
        tankStage: stageNum,
        tankStageLabel: comp.tankStage || stageToLabel(tank.currentStage),
        waterVolumeLiters: comp.waterVolumeLiters,
        linkedPlantIds: tank.irrigationBedIds,
        linkedPlantNames,
        cadenceLabel: `Every ${tank.intervalDays}d cycle`,
      });
      continue;
    }

    // Determine if this tank is due on or before selectedDate, or falls on a projected future cycle day
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
      const refillNote = projectedStage === 3 ? ' + full fresh refill' : '';
      activities.push({
        key: `fish_tank:${tank.id}:${selectedDate}`,
        taskType: 'fish_tank',
        sourceId: tank.id,
        title: `${tank.name} — reduce by ${stageLabel}${refillNote}`,
        subtitle: `Discharge ${formatVolume(dischargeLiters, volumeUnit)} for irrigation → ${
          linkedPlantNames.length > 0 ? linkedPlantNames.join(', ') : 'Select beds to irrigate'
        }`,
        zoneOrDetail: `${tank.species} · ${formatVolume(tank.capacityLiters, volumeUnit)} tank`,
        dueDate: effectiveDueDate,
        daysOverdue: overdueDays,
        urgency: overdueDays > 0 ? 'overdue' : selectedDate === todayDate ? 'due_today' : 'upcoming',
        assigneeId: tank.assigneeId,
        assigneeName: getMemberName(members, tank.assigneeId),
        assigneeUid: tank.assigneeUid,
        isDoneForDay: false,
        tankStage: projectedStage,
        tankStageLabel: stageLabel,
        waterVolumeLiters: dischargeLiters,
        linkedPlantIds: tank.irrigationBedIds,
        linkedPlantNames,
        cadenceLabel: `Every ${tank.intervalDays}d (${stageLabel} step)`,
      });
    }
  }

  // 2. Plant Care Activities (Watering, Mulching, Pruning)
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
        detail: plant.receivesFishWater
          ? 'Accepts fish tank effluent water'
          : 'Fresh irrigation watering',
      },
      {
        enabled: plant.mulchEnabled,
        taskType: 'mulch',
        everyDays: plant.mulchEveryDays,
        lastDate: plant.lastMulchedDate,
        assigneeId: plant.mulchAssigneeId,
        assigneeUid: plant.mulchAssigneeUid,
        verb: 'Add mulch to',
        detail: 'Top-dress organic straw/compost mulch',
      },
      {
        enabled: plant.pruneEnabled,
        taskType: 'prune',
        everyDays: plant.pruneEveryDays,
        lastDate: plant.lastPrunedDate,
        assigneeId: plant.pruneAssigneeId,
        assigneeUid: plant.pruneAssigneeUid,
        verb: 'Prune',
        detail: 'Trim suckers, deadwood & shape canopy',
      },
    ];

    for (const cfg of careConfigs) {
      if (!cfg.enabled) continue;
      const comp = findCompletion(cfg.taskType, plant.id);
      if (comp) {
        activities.push({
          key: `${cfg.taskType}:${plant.id}:${selectedDate}`,
          taskType: cfg.taskType,
          sourceId: plant.id,
          title: `${cfg.verb} ${plant.name}`,
          subtitle: comp.notes || cfg.detail,
          zoneOrDetail: `${plant.zone} · ${plant.category}`,
          dueDate: selectedDate,
          daysOverdue: 0,
          urgency: 'done',
          assigneeId: cfg.assigneeId,
          assigneeName: comp.assignedMemberName || getMemberName(members, cfg.assigneeId),
          assigneeUid: cfg.assigneeUid,
          isDoneForDay: true,
          completionLog: comp,
          receivesFishWater: plant.receivesFishWater,
          cadenceLabel: `Every ${cfg.everyDays}d`,
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
          taskType: cfg.taskType,
          sourceId: plant.id,
          title: `${cfg.verb} ${plant.name}`,
          subtitle: cfg.detail,
          zoneOrDetail: `${plant.zone} · ${plant.category}`,
          dueDate: effectiveDue,
          daysOverdue: overdueDays,
          urgency: overdueDays > 0 ? 'overdue' : selectedDate === todayDate ? 'due_today' : 'upcoming',
          assigneeId: cfg.assigneeId,
          assigneeName: getMemberName(members, cfg.assigneeId),
          assigneeUid: cfg.assigneeUid,
          isDoneForDay: false,
          receivesFishWater: plant.receivesFishWater,
          cadenceLabel: `Every ${cfg.everyDays}d`,
        });
      }
    }
  }

  // 3. Custom Tasks
  for (const task of tasks) {
    const comp = findCompletion('custom', task.id);
    if (comp) {
      activities.push({
        key: `custom:${task.id}:${selectedDate}`,
        taskType: 'custom',
        sourceId: task.id,
        title: task.title,
        subtitle: task.notes || 'Custom farm task',
        zoneOrDetail: task.category.replace('_', ' '),
        dueDate: selectedDate,
        daysOverdue: 0,
        urgency: 'done',
        assigneeId: task.assigneeId,
        assigneeName: comp.assignedMemberName || getMemberName(members, task.assigneeId),
        assigneeUid: task.assigneeUid,
        isDoneForDay: true,
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
        taskType: 'custom',
        sourceId: task.id,
        title: task.title,
        subtitle: task.notes || 'Scheduled farm duty',
        zoneOrDetail: task.category.replace('_', ' '),
        dueDate: effectiveDue,
        daysOverdue: overdueDays,
        urgency: overdueDays > 0 ? 'overdue' : selectedDate === todayDate ? 'due_today' : 'upcoming',
        assigneeId: task.assigneeId,
        assigneeName: getMemberName(members, task.assigneeId),
        assigneeUid: task.assigneeUid,
        isDoneForDay: false,
        cadenceLabel: task.recurrenceDays > 0 ? `Every ${task.recurrenceDays}d` : 'One-time',
      });
    }
  }

  // Sort: Overdue first, then Due Today (Fish Tank first, then Water, Mulch, Prune, Custom), then Done
  const urgencyRank: Record<ScheduledActivity['urgency'], number> = {
    overdue: 0,
    due_today: 1,
    upcoming: 2,
    done: 3,
  };
  const typeRank: Record<ScheduledActivity['taskType'], number> = {
    fish_tank: 0,
    water: 1,
    mulch: 2,
    prune: 3,
    custom: 4,
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
