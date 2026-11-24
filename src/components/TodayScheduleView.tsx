import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Droplets,
  Fish,
  Layers,
  PawPrint,
  Plus,
  RotateCcw,
  Scissors,
  ShieldCheck,
  Trash2,
  UserPlus,
  Wrench,
} from 'lucide-react';
import type {
  AnimalTask,
  CompletionLog,
  CustomTask,
  Farm,
  FarmMember,
  FishTank,
  MemberRole,
  PlantSchedule,
  ScheduledActivity,
} from '../types';
import {
  addDays,
  buildDailySchedule,
  formatReadableDate,
  formatVolume,
  getStageDischargeLiters,
  isCompletionConfirmed,
  isCompletionPending,
  stageToLabel,
} from '../utils/schedule';

interface TodayScheduleViewProps {
  farm: Farm;
  userRole: MemberRole;
  todayDate: string;
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
  plants: PlantSchedule[];
  fishTanks: FishTank[];
  animalTasks: AnimalTask[];
  tasks: CustomTask[];
  members: FarmMember[];
  completions: CompletionLog[];
  selectedMemberFilter: string;
  onSelectMemberFilter: (memberId: string) => void;
  onCompleteActivity: (
    activity: ScheduledActivity,
    options: {
      note: string;
      alsoWaterLinkedBeds: boolean;
      actingMemberName: string;
      submitForConfirmation?: boolean;
    }
  ) => Promise<void>;
  onConfirmCompletion: (log: CompletionLog, alsoWaterLinkedBeds: boolean) => Promise<void>;
  onUndoCompletion: (log: CompletionLog) => Promise<void>;
  onDeleteActivity: (activity: ScheduledActivity) => Promise<void>;
  onOpenNewTask: () => void;
  onOpenAddPerson: () => void;
  onJumpToAnimalFarm: () => void;
}

export function TodayScheduleView({
  farm,
  userRole,
  todayDate,
  selectedDate,
  onSelectDate,
  plants,
  fishTanks,
  animalTasks,
  tasks,
  members,
  completions,
  selectedMemberFilter,
  onSelectMemberFilter,
  onCompleteActivity,
  onConfirmCompletion,
  onUndoCompletion,
  onDeleteActivity,
  onOpenNewTask,
  onOpenAddPerson,
  onJumpToAnimalFarm,
}: TodayScheduleViewProps) {
  const isManager = userRole === 'manager';
  const [areaFilter, setAreaFilter] = useState<'all' | 'plants' | 'animals' | 'general'>('all');
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [signOffNote, setSignOffNote] = useState('');
  const [alsoWaterLinkedBeds, setAlsoWaterLinkedBeds] = useState(true);
  const [confirmWaterByLog, setConfirmWaterByLog] = useState<Record<string, boolean>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null);

  const allActivities = useMemo(
    () =>
      buildDailySchedule({
        selectedDate,
        todayDate,
        plants,
        fishTanks,
        animalTasks,
        tasks,
        members,
        completions,
        volumeUnit: farm.volumeUnit,
      }),
    [
      selectedDate,
      todayDate,
      plants,
      fishTanks,
      animalTasks,
      tasks,
      members,
      completions,
      farm.volumeUnit,
    ]
  );

  const activeMembers = useMemo(() => members.filter((m) => m.active), [members]);

  // All completions across the farm currently waiting for manager confirmation
  const pendingApprovalLogs = useMemo(
    () => completions.filter((c) => isCompletionPending(c)),
    [completions]
  );

  const filteredActivities = useMemo(() => {
    return allActivities.filter((a) => {
      if (isManager && selectedMemberFilter !== 'all' && a.assigneeId !== selectedMemberFilter) {
        return false;
      }
      if (areaFilter !== 'all' && a.farmArea !== areaFilter) {
        return false;
      }
      return true;
    });
  }, [allActivities, isManager, selectedMemberFilter, areaFilter]);

  const toDoActivities = filteredActivities.filter(
    (a) => !a.isDoneForDay && !a.isPendingConfirmation
  );
  const waitingActivitiesOnDate = filteredActivities.filter((a) => a.isPendingConfirmation);
  const confirmedActivities = filteredActivities.filter((a) => a.isDoneForDay);

  const overdueCount = allActivities.filter(
    (a) => !a.isDoneForDay && !a.isPendingConfirmation && a.urgency === 'overdue'
  ).length;
  const pendingCount = allActivities.filter(
    (a) => !a.isDoneForDay && !a.isPendingConfirmation
  ).length;
  const doneCount = allActivities.filter((a) => a.isDoneForDay).length;
  const fishWaterUsedLiters = completions
    .filter(
      (c) =>
        c.dateKey === selectedDate && c.taskType === 'fish_tank' && isCompletionConfirmed(c)
    )
    .reduce((sum, c) => sum + c.waterVolumeLiters, 0);

  const crewProgress = useMemo(() => {
    return activeMembers.map((m) => {
      const assigned = allActivities.filter((a) => a.assigneeId === m.id);
      const done = assigned.filter((a) => a.isDoneForDay).length;
      const waiting = assigned.filter((a) => a.isPendingConfirmation).length;
      return {
        member: m,
        total: assigned.length,
        done,
        waiting,
      };
    });
  }, [activeMembers, allActivities]);

  const selectedMemberObj = members.find((m) => m.id === selectedMemberFilter);

  const handleQuickSignOff = async (activity: ScheduledActivity) => {
    // Open drawer for fish tanks (for irrigation checkbox) or when worker wants to add a note
    if (activity.taskType === 'fish_tank' && confirmingKey !== activity.key) {
      setConfirmingKey(activity.key);
      setSignOffNote('');
      setAlsoWaterLinkedBeds(true);
      return;
    }

    setBusyKey(activity.key);
    try {
      const actingName = isManager
        ? selectedMemberObj?.name || activity.assigneeName || 'Farm Manager'
        : members[0]?.name || activity.assigneeName || 'Farm Worker';

      // When a manager taps a task assigned to a worker while filtering by that worker (shared device),
      // submit for confirmation? Actually manager is logged in; if userRole === 'worker' farmService ALWAYS enforces pending_confirmation.
      await onCompleteActivity(activity, {
        note: confirmingKey === activity.key ? signOffNote : '',
        alsoWaterLinkedBeds,
        actingMemberName: actingName,
        submitForConfirmation: !isManager,
      });
      setConfirmingKey(null);
      setSignOffNote('');
    } finally {
      setBusyKey(null);
    }
  };

  const handleConfirmLog = async (log: CompletionLog) => {
    setBusyKey(log.id);
    try {
      await onConfirmCompletion(log, confirmWaterByLog[log.id] ?? true);
    } finally {
      setBusyKey(null);
    }
  };

  const handleUndo = async (log: CompletionLog) => {
    setBusyKey(log.id);
    try {
      await onUndoCompletion(log);
    } finally {
      setBusyKey(null);
    }
  };

  const handleDelete = async (activity: ScheduledActivity) => {
    setBusyKey(activity.key);
    try {
      await onDeleteActivity(activity);
      setDeleteConfirmKey(null);
    } finally {
      setBusyKey(null);
    }
  };

  const renderActivityIcon = (taskType: ScheduledActivity['taskType']) => {
    switch (taskType) {
      case 'fish_tank':
        return <Fish className="w-5 h-5 text-[#0369A1] shrink-0" />;
      case 'animal':
        return <PawPrint className="w-5 h-5 text-[#B45309] shrink-0" />;
      case 'water':
        return <Droplets className="w-5 h-5 text-[#0284C7] shrink-0" />;
      case 'mulch':
        return <Layers className="w-5 h-5 text-[#92400E] shrink-0" />;
      case 'prune':
        return <Scissors className="w-5 h-5 text-[#15803D] shrink-0" />;
      default:
        return <Wrench className="w-5 h-5 text-[#475569] shrink-0" />;
    }
  };

  const getDeleteLabel = (taskType: ScheduledActivity['taskType']) => {
    if (taskType === 'water') return 'Turn off watering?';
    if (taskType === 'mulch') return 'Turn off mulching?';
    if (taskType === 'prune') return 'Turn off pruning?';
    if (taskType === 'fish_tank') return 'Delete tank?';
    return 'Delete task?';
  };

  const isToday = selectedDate === todayDate;

  return (
    <div className="space-y-6">
      {/* Simple 4-Number Daily Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-[#E2E8E5] rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-[#E8EEEA]">
        <div className="p-5">
          <div className="text-xs font-medium text-[#5A6E64] mb-1">To Do</div>
          <div className="font-mono text-2xl font-bold text-[#112119] tabular-nums">
            {pendingCount}
          </div>
          <div className="text-xs text-[#64786E] mt-1">
            {isToday ? 'Jobs left today' : formatReadableDate(selectedDate)}
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-[#5A6E64] mb-1">Waiting Confirmation</div>
          <div
            className={`font-mono text-2xl font-bold tabular-nums ${
              pendingApprovalLogs.length > 0 ? 'text-[#B45309]' : 'text-[#4B5E55]'
            }`}
          >
            {pendingApprovalLogs.length}
          </div>
          <div className="text-xs text-[#64786E] mt-1">
            {isManager ? 'Needs manager approval' : 'Sent to your manager'}
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-[#5A6E64] mb-1">Confirmed Done</div>
          <div className="font-mono text-2xl font-bold text-[#15803D] tabular-nums">
            {doneCount}
            <span className="text-sm font-normal text-[#64786E]"> / {allActivities.length}</span>
          </div>
          <div className="text-xs text-[#64786E] mt-1">
            {overdueCount > 0 ? `${overdueCount} late job${overdueCount === 1 ? '' : 's'}` : 'On track'}
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-[#5A6E64] mb-1">Fish Water Used</div>
          <div className="font-mono text-2xl font-bold text-[#0369A1] tabular-nums">
            {formatVolume(fishWaterUsedLiters, farm.volumeUnit)}
          </div>
          <div className="text-xs text-[#64786E] mt-1">Confirmed for crop beds</div>
        </div>
      </div>

      {/* Mandatory Manager Confirmation Queue */}
      {isManager && pendingApprovalLogs.length > 0 && (
        <div className="bg-white border border-[#F59E0B] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#FEF3C7] bg-[#FFFBEB] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-[#B45309] shrink-0" />
              <div>
                <h3 className="font-display text-sm font-bold text-[#92400E]">
                  Waiting for Manager Confirmation ({pendingApprovalLogs.length})
                </h3>
                <p className="text-xs text-[#92400E]/85 mt-0.5">
                  Workers marked these tasks done. Confirm them to record completion and advance the next due date.
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-[#EDF1EE]">
            {pendingApprovalLogs.map((log) => {
              const isBusy = busyKey === log.id;
              const isFishTank = log.taskType === 'fish_tank';
              const waterBedsChecked = confirmWaterByLog[log.id] ?? true;

              return (
                <div
                  key={log.id}
                  className="px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                      <span className="text-sm font-semibold text-[#112119]">{log.sourceTitle}</span>
                      <span className="text-xs font-mono text-[#64786E] tabular-nums">
                        {formatReadableDate(log.dateKey)}
                      </span>
                    </div>
                    <div className="text-xs text-[#4B5E55]">
                      Marked done by{' '}
                      <strong className="font-semibold text-[#112119]">{log.completedByName}</strong>
                      {log.tankStage ? ` · ${log.tankStage} water change` : ''}
                      {log.notes ? ` · "${log.notes}"` : ''}
                    </div>
                    {isFishTank && (
                      <label className="inline-flex items-center gap-2 text-xs text-[#30433A] pt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={waterBedsChecked}
                          onChange={(e) =>
                            setConfirmWaterByLog((prev) => ({
                              ...prev,
                              [log.id]: e.target.checked,
                            }))
                          }
                          className="rounded border-[#94A3B8] text-[#0369A1]"
                        />
                        <span>Also mark linked crop beds watered</span>
                      </label>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleConfirmLog(log)}
                      className="h-10 px-4 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] disabled:opacity-60 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      {isBusy ? 'Confirming…' : 'Confirm Done'}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleUndo(log)}
                      className="h-10 px-3 text-xs font-medium text-[#B91C1C] border border-[#FECACA] hover:bg-[#FEF2F2] rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Send Back
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Daily Checklist */}
        <div className={isManager ? 'xl:col-span-8 space-y-5' : 'xl:col-span-12 space-y-5'}>
          {/* Date, Area & Person Selector */}
          <div className="bg-white border border-[#E2E8E5] rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-bold text-[#112119] tracking-tight">
                  {isManager
                    ? isToday
                      ? "Today's Tasks"
                      : `Tasks for ${formatReadableDate(selectedDate)}`
                    : isToday
                      ? 'My Tasks Today'
                      : `My Tasks — ${formatReadableDate(selectedDate)}`}
                </h2>
                <p className="text-xs text-[#5A6E64] mt-0.5">
                  {isManager
                    ? 'Organized by Plants and Animal Farm. Tap Mark Done or delete any task you no longer need.'
                    : 'Tap Mark Done when you finish a job. Your manager will confirm it.'}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onSelectDate(addDays(selectedDate, -1))}
                  aria-label="Previous day"
                  className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-[#DCE4DF] text-[#30433A] hover:bg-[#F3F6F4] transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onSelectDate(todayDate)}
                  className={`h-10 px-3.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isToday
                      ? 'bg-[#14532D] text-white border-[#14532D]'
                      : 'bg-white text-[#112119] border-[#DCE4DF] hover:bg-[#F3F6F4]'
                  }`}
                >
                  Today · {formatReadableDate(todayDate)}
                </button>
                <button
                  type="button"
                  onClick={() => onSelectDate(addDays(selectedDate, 1))}
                  aria-label="Next day"
                  className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-[#DCE4DF] text-[#30433A] hover:bg-[#F3F6F4] transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Area Switcher (All / Plants / Animal Farm / Other) + Crew Filter */}
            <div className="pt-4 border-t border-[#EDF1EE] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 bg-[#F2F5F3] p-1 rounded-lg overflow-x-auto max-w-full">
                {(
                  [
                    { id: 'all', label: `All (${allActivities.length})` },
                    {
                      id: 'plants',
                      label: `Plants (${allActivities.filter((a) => a.farmArea === 'plants').length})`,
                    },
                    {
                      id: 'animals',
                      label: `Animal Farm (${allActivities.filter((a) => a.farmArea === 'animals').length})`,
                    },
                    {
                      id: 'general',
                      label: `Other (${allActivities.filter((a) => a.farmArea === 'general').length})`,
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAreaFilter(opt.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      areaFilter === opt.id
                        ? 'bg-white text-[#112119] shadow-xs'
                        : 'text-[#52665C] hover:text-[#112119]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {isManager && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <select
                    value={selectedMemberFilter}
                    onChange={(e) => onSelectMemberFilter(e.target.value)}
                    aria-label="Filter tasks by person"
                    className="h-9 px-3 text-xs font-medium bg-[#F8FAF9] border border-[#DCE4DF] rounded-lg text-[#112119] focus:outline-none focus:border-[#14532D]"
                  >
                    <option value="all">Everyone</option>
                    {activeMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={onOpenAddPerson}
                    className="h-9 px-3 text-xs font-medium text-[#14532D] border border-dashed border-[#B7CEC0] hover:bg-[#EEF6F0] rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Add Person
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Pending Tasks List */}
          <div className="bg-white border border-[#E2E8E5] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#EDF1EE] flex items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-base font-bold text-[#112119]">
                  To Do ({toDoActivities.length})
                </h3>
                <p className="text-xs text-[#64786E] mt-0.5">
                  {isManager && selectedMemberObj
                    ? `Showing jobs for ${selectedMemberObj.name}`
                    : 'Late jobs, fish tank water changes, animal care, and plant care'}
                </p>
              </div>
              {isManager && (
                <button
                  type="button"
                  onClick={onOpenNewTask}
                  className="h-9 px-3 text-xs font-semibold text-[#14532D] hover:bg-[#EEF6F0] rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Task
                </button>
              )}
            </div>

            {toDoActivities.length === 0 ? (
              <div className="p-10 text-center">
                <p className="font-display text-base font-semibold text-[#112119] mb-1">
                  Nothing left to do for {isToday ? 'today' : formatReadableDate(selectedDate)}
                </p>
                <p className="text-xs text-[#64786E] max-w-sm mx-auto mb-4">
                  {isManager
                    ? 'All tasks in this view are either finished or waiting for confirmation.'
                    : 'You have finished all of your assigned jobs for this day.'}
                </p>
                {isManager && (
                  <button
                    type="button"
                    onClick={onOpenNewTask}
                    className="h-10 px-4 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Add a Task
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[#EDF1EE]">
                {toDoActivities.map((activity) => {
                  const isBusy = busyKey === activity.key;
                  const isConfirming = confirmingKey === activity.key;
                  const isConfirmingDelete = deleteConfirmKey === activity.key;

                  return (
                    <div
                      key={activity.key}
                      className="px-5 py-4 hover:bg-[#FAFDFB] transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div className="mt-0.5">{renderActivityIcon(activity.taskType)}</div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                              <span className="text-[15px] font-semibold text-[#112119]">
                                {activity.title}
                              </span>
                              {activity.urgency === 'overdue' && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B91C1C]">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  Late by {activity.daysOverdue}d
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-[#4B5E55] mt-1 leading-relaxed">
                              {activity.subtitle}
                            </p>

                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#64786E]">
                              <span>
                                Person:{' '}
                                <strong className="font-semibold text-[#112119]">
                                  {activity.assigneeName}
                                </strong>
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">{activity.cadenceLabel}</span>
                              <span aria-hidden="true">·</span>
                              <span>{activity.zoneOrDetail}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 sm:self-center">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleQuickSignOff(activity)}
                            className={`h-10 px-4 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
                              activity.taskType === 'fish_tank'
                                ? 'bg-[#0369A1] hover:bg-[#075985] text-white'
                                : 'bg-[#14532D] hover:bg-[#0F3F22] text-white'
                            }`}
                          >
                            <Check className="w-4 h-4" />
                            {isBusy
                              ? 'Saving…'
                              : !isManager
                                ? 'Mark Done'
                                : activity.taskType === 'fish_tank' && !isConfirming
                                  ? `Done (${activity.tankStageLabel})`
                                  : 'Mark Done'}
                          </button>

                          {isManager &&
                            (isConfirmingDelete ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleDelete(activity)}
                                  className="h-10 px-2.5 text-xs font-semibold text-white bg-[#B91C1C] hover:bg-[#991B1B] rounded-lg whitespace-nowrap cursor-pointer"
                                >
                                  {getDeleteLabel(activity.taskType)}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmKey(null)}
                                  className="h-10 px-2 text-xs text-[#5A6E64] cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmKey(activity.key)}
                                aria-label={`Delete ${activity.title}`}
                                title="Remove this task"
                                className="h-10 w-10 inline-flex items-center justify-center text-[#64786E] hover:text-[#B91C1C] hover:bg-[#FEF2F2] rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ))}
                        </div>
                      </div>

                      {/* Confirmation Drawer for Fish Tank Watering Linkage */}
                      {isConfirming && (
                        <div className="mt-4 sm:ml-8 pt-4 border-t border-[#E6ECE9] space-y-3">
                          {isManager &&
                            activity.taskType === 'fish_tank' &&
                            activity.linkedPlantNames &&
                            activity.linkedPlantNames.length > 0 && (
                              <label className="flex items-start gap-2.5 text-xs text-[#112119] cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={alsoWaterLinkedBeds}
                                  onChange={(e) => setAlsoWaterLinkedBeds(e.target.checked)}
                                  className="mt-0.5 rounded border-[#94A3B8] text-[#0369A1]"
                                />
                                <span>
                                  Also mark these beds watered with the fish water today:{' '}
                                  <strong className="font-semibold">
                                    {activity.linkedPlantNames.join(', ')}
                                  </strong>{' '}
                                  ({formatVolume(activity.waterVolumeLiters || 0, farm.volumeUnit)})
                                </span>
                              </label>
                            )}

                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={signOffNote}
                              onChange={(e) => setSignOffNote(e.target.value)}
                              maxLength={300}
                              placeholder="Optional note (e.g. refilled tank, soil looks good)…"
                              className="flex-1 min-w-[200px] h-10 px-3 text-xs bg-[#F8FAF9] border border-[#D4DDD8] rounded-lg text-[#112119] placeholder:text-[#7A8E84] focus:outline-none focus:border-[#14532D]"
                            />
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleQuickSignOff(activity)}
                              className="h-10 px-4 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              {isBusy
                                ? 'Saving…'
                                : isManager
                                  ? 'Confirm Done'
                                  : 'Send to Manager'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingKey(null)}
                              className="h-10 px-3 text-xs font-medium text-[#5A6E64] hover:text-[#112119] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Worker view: Submitted tasks waiting for manager confirmation */}
          {!isManager && waitingActivitiesOnDate.length > 0 && (
            <div className="bg-white border border-[#F59E0B] rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#FEF3C7] bg-[#FFFBEB]">
                <h3 className="font-display text-sm font-bold text-[#92400E]">
                  Waiting for Manager Confirmation ({waitingActivitiesOnDate.length})
                </h3>
              </div>
              <div className="divide-y divide-[#EDF1EE]">
                {waitingActivitiesOnDate.map((activity) => (
                  <div
                    key={activity.key}
                    className="px-5 py-3.5 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="mt-0.5 w-5 h-5 rounded-md bg-[#FEF3C7] text-[#B45309] inline-flex items-center justify-center shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#112119]">{activity.title}</div>
                        <div className="text-xs text-[#92400E] mt-0.5">
                          Submitted — waiting for your manager to confirm
                        </div>
                      </div>
                    </div>

                    {activity.completionLog && (
                      <button
                        type="button"
                        disabled={busyKey === activity.completionLog.id}
                        onClick={() => void handleUndo(activity.completionLog!)}
                        className="h-9 px-3 text-xs font-medium text-[#5A6E64] hover:text-[#112119] hover:bg-[#EDF2EF] rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Withdraw
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confirmed Done Section */}
          {confirmedActivities.length > 0 && (
            <div className="bg-white border border-[#E2E8E5] rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#EDF1EE]">
                <h3 className="font-display text-sm font-bold text-[#15803D]">
                  Confirmed Done {isToday ? 'Today' : formatReadableDate(selectedDate)} (
                  {confirmedActivities.length})
                </h3>
              </div>
              <div className="divide-y divide-[#EDF1EE]">
                {confirmedActivities.map((activity) => (
                  <div
                    key={activity.key}
                    className="px-5 py-3.5 flex items-center justify-between gap-4 bg-[#FAFDFB]"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="mt-0.5 w-5 h-5 rounded-md bg-[#DCFCE7] text-[#15803D] inline-flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#4B5E55] line-through">
                          {activity.title}
                        </div>
                        <div className="text-xs text-[#64786E] mt-0.5 flex flex-wrap items-center gap-x-2">
                          <span>
                            Done by{' '}
                            <strong className="font-medium text-[#30433A]">
                              {activity.completionLog?.completedByName || activity.assigneeName}
                            </strong>
                          </span>
                          {activity.completionLog?.confirmedByName && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#15803D]">
                                Confirmed by {activity.completionLog.confirmedByName}
                              </span>
                            </>
                          )}
                          {activity.completionLog?.notes && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="italic">{activity.completionLog.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {isManager && activity.completionLog && (
                      <button
                        type="button"
                        disabled={busyKey === activity.completionLog.id}
                        onClick={() => void handleUndo(activity.completionLog!)}
                        className="h-9 px-3 text-xs font-medium text-[#5A6E64] hover:text-[#112119] hover:bg-[#EDF2EF] rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Undo
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Side (Manager Only): Fish Tank Status + People Progress */}
        {isManager && (
          <div className="xl:col-span-4 space-y-5">
            <div className="bg-white border border-[#E2E8E5] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#EDF1EE] flex items-center justify-between gap-2">
                <h3 className="font-display text-sm font-bold text-[#112119]">
                  Fish Tank Water Cycle
                </h3>
                <button
                  type="button"
                  onClick={onJumpToAnimalFarm}
                  className="text-xs font-semibold text-[#0369A1] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Open Animal Farm
                </button>
              </div>

              {fishTanks.length === 0 ? (
                <div className="p-5 text-xs text-[#64786E]">
                  No fish tanks added yet. Open Animal Farm to track your 1/4 → 2/4 → 3/4 cycle.
                </div>
              ) : (
                <div className="divide-y divide-[#EDF1EE]">
                  {fishTanks.map((tank) => {
                    const stageLabel = stageToLabel(tank.currentStage);
                    const discharge = getStageDischargeLiters(
                      tank.capacityLiters,
                      tank.currentStage
                    );
                    const isDueNow = tank.nextDrawdownDate <= todayDate;
                    return (
                      <div key={tank.id} className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-[#112119]">{tank.name}</div>
                            <div className="text-xs text-[#64786E] mt-0.5">
                              {tank.species} ·{' '}
                              <span className="font-mono tabular-nums">
                                {formatVolume(tank.capacityLiters, farm.volumeUnit)}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`font-mono text-xs font-semibold tabular-nums ${
                              isDueNow ? 'text-[#B45309]' : 'text-[#0369A1]'
                            }`}
                          >
                            Drain {stageLabel}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                          {([1, 2, 3] as const).map((step) => {
                            const active = tank.currentStage === step;
                            const passed = tank.currentStage > step;
                            return (
                              <div
                                key={step}
                                className={`px-2.5 py-2 rounded-lg border text-center ${
                                  active
                                    ? 'bg-[#E0F2FE] border-[#7DD3FC] text-[#0C4A6E]'
                                    : passed
                                      ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
                                      : 'bg-[#F8FAF9] border-[#E6ECE9] text-[#64786E]'
                                }`}
                              >
                                <div className="font-mono text-xs font-bold tabular-nums">
                                  {step}/4
                                </div>
                                <div className="text-[11px] mt-0.5">
                                  Day {step * tank.intervalDays}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="text-xs text-[#4B5E55] flex items-center justify-between pt-1">
                          <span>
                            Next:{' '}
                            <strong className="font-mono font-semibold text-[#112119] tabular-nums">
                              {tank.nextDrawdownDate === todayDate
                                ? 'Today'
                                : formatReadableDate(tank.nextDrawdownDate)}
                            </strong>
                          </span>
                          <span className="font-mono text-[#0369A1] font-semibold tabular-nums">
                            {formatVolume(discharge, farm.volumeUnit)} for plants
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white border border-[#E2E8E5] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#EDF1EE] flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-sm font-bold text-[#112119]">
                    People Working Today
                  </h3>
                  <p className="text-xs text-[#64786E] mt-0.5">Tap a name to filter their jobs</p>
                </div>
                <button
                  type="button"
                  onClick={onOpenAddPerson}
                  className="text-xs font-semibold text-[#14532D] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  + Add
                </button>
              </div>
              <div className="divide-y divide-[#EDF1EE]">
                {crewProgress.map(({ member, total, done, waiting }) => {
                  const pct = total > 0 ? Math.round((done / total) * 100) : 100;
                  const isSelected = selectedMemberFilter === member.id;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => onSelectMemberFilter(isSelected ? 'all' : member.id)}
                      className={`w-full text-left px-5 py-3.5 transition-colors cursor-pointer ${
                        isSelected ? 'bg-[#EEF6F0]' : 'hover:bg-[#FAFDFB]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-[#112119]">{member.name}</span>
                        <span className="font-mono tabular-nums text-[#4B5E55]">
                          {done}/{total} done
                          {waiting > 0 && (
                            <span className="text-[#B45309] ml-1.5">({waiting} waiting)</span>
                          )}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#E6ECE9] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#15803D] transition-all duration-200"
                          style={{ width: `${total === 0 ? 0 : pct}%` }}
                        />
                      </div>
                      {member.specialty && (
                        <div className="text-[11px] text-[#64786E] mt-1 truncate">
                          {member.specialty}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
