import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Fish,
  Layers,
  Plus,
  RotateCcw,
  Scissors,
  Wrench,
} from 'lucide-react';
import type {
  CompletionLog,
  CustomTask,
  Farm,
  FarmMember,
  FishTank,
  PlantSchedule,
  ScheduledActivity,
} from '../types';
import {
  addDays,
  buildDailySchedule,
  formatReadableDate,
  formatVolume,
  getStageDischargeLiters,
  stageToLabel,
} from '../utils/schedule';

interface TodayScheduleViewProps {
  farm: Farm;
  todayDate: string;
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
  plants: PlantSchedule[];
  fishTanks: FishTank[];
  tasks: CustomTask[];
  members: FarmMember[];
  completions: CompletionLog[];
  selectedMemberFilter: string;
  onSelectMemberFilter: (memberId: string) => void;
  onCompleteActivity: (
    activity: ScheduledActivity,
    options: { note: string; alsoWaterLinkedBeds: boolean; actingMemberName: string }
  ) => Promise<void>;
  onUndoCompletion: (log: CompletionLog) => Promise<void>;
  onOpenNewTask: () => void;
  onJumpToFishTanks: () => void;
}

export function TodayScheduleView({
  farm,
  todayDate,
  selectedDate,
  onSelectDate,
  plants,
  fishTanks,
  tasks,
  members,
  completions,
  selectedMemberFilter,
  onSelectMemberFilter,
  onCompleteActivity,
  onUndoCompletion,
  onOpenNewTask,
  onJumpToFishTanks,
}: TodayScheduleViewProps) {
  const [typeFilter, setTypeFilter] = useState<'all' | 'fish_tank' | 'water' | 'mulch' | 'prune' | 'custom'>('all');
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [signOffNote, setSignOffNote] = useState('');
  const [alsoWaterLinkedBeds, setAlsoWaterLinkedBeds] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const allActivities = useMemo(
    () =>
      buildDailySchedule({
        selectedDate,
        todayDate,
        plants,
        fishTanks,
        tasks,
        members,
        completions,
        volumeUnit: farm.volumeUnit,
      }),
    [selectedDate, todayDate, plants, fishTanks, tasks, members, completions, farm.volumeUnit]
  );

  const activeMembers = useMemo(() => members.filter((m) => m.active), [members]);

  const filteredActivities = useMemo(() => {
    return allActivities.filter((a) => {
      if (selectedMemberFilter !== 'all' && a.assigneeId !== selectedMemberFilter) {
        return false;
      }
      if (typeFilter !== 'all' && a.taskType !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [allActivities, selectedMemberFilter, typeFilter]);

  const pendingActivities = filteredActivities.filter((a) => !a.isDoneForDay);
  const completedActivities = filteredActivities.filter((a) => a.isDoneForDay);

  // KPI metrics for selectedDate (across all crew so manager sees farm-wide pulse)
  const overdueCount = allActivities.filter((a) => !a.isDoneForDay && a.urgency === 'overdue').length;
  const pendingCount = allActivities.filter((a) => !a.isDoneForDay).length;
  const doneCount = allActivities.filter((a) => a.isDoneForDay).length;
  const effluentIrrigatedLiters = completions
    .filter((c) => c.dateKey === selectedDate && c.taskType === 'fish_tank')
    .reduce((sum, c) => sum + c.waterVolumeLiters, 0);

  // Per-member daily progress summary
  const crewProgress = useMemo(() => {
    return activeMembers.map((m) => {
      const assigned = allActivities.filter((a) => a.assigneeId === m.id);
      const done = assigned.filter((a) => a.isDoneForDay).length;
      return {
        member: m,
        total: assigned.length,
        done,
      };
    });
  }, [activeMembers, allActivities]);

  const selectedMemberObj = members.find((m) => m.id === selectedMemberFilter);

  const handleQuickSignOff = async (activity: ScheduledActivity) => {
    // Fish tank drawdowns open the inline sign-off panel so operator confirms linked bed irrigation
    if (activity.taskType === 'fish_tank' && confirmingKey !== activity.key) {
      setConfirmingKey(activity.key);
      setSignOffNote('');
      setAlsoWaterLinkedBeds(true);
      return;
    }

    setBusyKey(activity.key);
    try {
      const actingName =
        selectedMemberObj?.name || activity.assigneeName || 'Farm Operator';
      await onCompleteActivity(activity, {
        note: confirmingKey === activity.key ? signOffNote : '',
        alsoWaterLinkedBeds,
        actingMemberName: actingName,
      });
      setConfirmingKey(null);
      setSignOffNote('');
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

  const renderActivityIcon = (taskType: ScheduledActivity['taskType']) => {
    switch (taskType) {
      case 'fish_tank':
        return <Fish className="w-4 h-4 text-[#0369A1] shrink-0" />;
      case 'water':
        return <Droplets className="w-4 h-4 text-[#0284C7] shrink-0" />;
      case 'mulch':
        return <Layers className="w-4 h-4 text-[#92400E] shrink-0" />;
      case 'prune':
        return <Scissors className="w-4 h-4 text-[#15803D] shrink-0" />;
      default:
        return <Wrench className="w-4 h-4 text-[#475569] shrink-0" />;
    }
  };

  const typeLabel = (taskType: ScheduledActivity['taskType']) => {
    switch (taskType) {
      case 'fish_tank':
        return 'Fish Tank Drawdown';
      case 'water':
        return 'Watering';
      case 'mulch':
        return 'Mulching';
      case 'prune':
        return 'Pruning';
      default:
        return 'Farm Duty';
    }
  };

  const isToday = selectedDate === todayDate;

  return (
    <div className="space-y-6">
      {/* 4-Column Operations Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-[#E2E8E5] rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-[#E8EEEA]">
        <div className="p-5">
          <div className="text-xs font-medium text-[#5A6E64] mb-1.5">Pending for Day</div>
          <div className="font-mono text-2xl font-semibold text-[#112119] tabular-nums">
            {pendingCount}
          </div>
          <div className="text-xs text-[#64786E] mt-1">
            {isToday ? 'Scheduled today' : formatReadableDate(selectedDate)}
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-[#5A6E64] mb-1.5">Overdue Alerts</div>
          <div
            className={`font-mono text-2xl font-semibold tabular-nums ${
              overdueCount > 0 ? 'text-[#B91C1C]' : 'text-[#15803D]'
            }`}
          >
            {overdueCount}
          </div>
          <div className="text-xs text-[#64786E] mt-1">
            {overdueCount > 0 ? 'Requires immediate sign-off' : 'All cycles on track'}
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-[#5A6E64] mb-1.5">Completed Today</div>
          <div className="font-mono text-2xl font-semibold text-[#15803D] tabular-nums">
            {doneCount}
            <span className="text-sm font-normal text-[#64786E]">
              {' '}
              / {allActivities.length}
            </span>
          </div>
          <div className="text-xs text-[#64786E] mt-1">
            {allActivities.length > 0
              ? `${Math.round((doneCount / allActivities.length) * 100)}% crew sign-off rate`
              : 'No activities scheduled'}
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-[#5A6E64] mb-1.5">Fish Effluent Irrigated</div>
          <div className="font-mono text-2xl font-semibold text-[#0369A1] tabular-nums">
            {formatVolume(effluentIrrigatedLiters, farm.volumeUnit)}
          </div>
          <div className="text-xs text-[#64786E] mt-1">
            Discharged &amp; routed to crop beds
          </div>
        </div>
      </div>

      {/* Main 2-Column Workspace Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Primary Column: Daily Task Checklist & Crew Filter */}
        <div className="xl:col-span-8 space-y-5">
          {/* Date Switcher & Crew Perspective Toolbar */}
          <div className="bg-white border border-[#E2E8E5] rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-bold text-[#112119] tracking-tight">
                  {isToday ? "Today's Farm Schedule" : `Schedule — ${formatReadableDate(selectedDate)}`}
                </h2>
                <p className="text-xs text-[#5A6E64] mt-0.5">
                  Select a crew member below to view their assigned checklist and mark tasks done for the day.
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
                  className={`h-10 px-3.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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

            {/* Crew Filter Bar (Interactive Functional Buttons) */}
            <div className="pt-4 border-t border-[#EDF1EE] flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onSelectMemberFilter('all')}
                  className={`h-9 px-3 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedMemberFilter === 'all'
                      ? 'bg-[#112119] text-white'
                      : 'bg-[#F2F5F3] text-[#3D5247] hover:bg-[#E5ECE8]'
                  }`}
                >
                  All Crew ({allActivities.length})
                </button>
                {activeMembers.map((member) => {
                  const memberCount = allActivities.filter((a) => a.assigneeId === member.id).length;
                  const active = selectedMemberFilter === member.id;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => onSelectMemberFilter(member.id)}
                      className={`h-9 px-3 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-[#14532D] text-white'
                          : 'bg-[#F2F5F3] text-[#3D5247] hover:bg-[#E5ECE8]'
                      }`}
                    >
                      {member.name} ({memberCount})
                    </button>
                  );
                })}
              </div>

              {/* Activity Type Filter */}
              <div className="flex items-center gap-1 bg-[#F2F5F3] p-1 rounded-lg overflow-x-auto max-w-full">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'fish_tank', label: 'Fish Tank' },
                    { id: 'water', label: 'Water' },
                    { id: 'mulch', label: 'Mulch' },
                    { id: 'prune', label: 'Prune' },
                    { id: 'custom', label: 'Duties' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTypeFilter(opt.id)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      typeFilter === opt.id
                        ? 'bg-white text-[#112119] shadow-xs'
                        : 'text-[#52665C] hover:text-[#112119]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Needed List */}
          <div className="bg-white border border-[#E2E8E5] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#EDF1EE] flex items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-sm font-semibold text-[#112119]">
                  Pending Sign-Off ({pendingActivities.length})
                </h3>
                <p className="text-xs text-[#64786E] mt-0.5">
                  {selectedMemberObj
                    ? `Assigned to ${selectedMemberObj.name} · ${selectedMemberObj.specialty || selectedMemberObj.role}`
                    : 'Sorted by overdue alerts and fish tank irrigation priority'}
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenNewTask}
                className="h-9 px-3 text-xs font-medium text-[#14532D] hover:bg-[#EEF6F0] rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Task
              </button>
            </div>

            {pendingActivities.length === 0 ? (
              <div className="p-10 text-center">
                <p className="font-display text-sm font-semibold text-[#112119] mb-1">
                  All caught up for {isToday ? 'today' : formatReadableDate(selectedDate)}
                </p>
                <p className="text-xs text-[#64786E] max-w-sm mx-auto mb-4">
                  No pending watering, mulching, pruning, or fish tank tasks match this filter.
                </p>
                <button
                  type="button"
                  onClick={onOpenNewTask}
                  className="h-10 px-4 text-xs font-medium text-white bg-[#14532D] hover:bg-[#0F3F22] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  Schedule Custom Activity
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#EDF1EE]">
                {pendingActivities.map((activity) => {
                  const isBusy = busyKey === activity.key;
                  const isConfirming = confirmingKey === activity.key;
                  return (
                    <div
                      key={activity.key}
                      className="px-5 py-4 hover:bg-[#FAFDFB] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div className="mt-0.5">{renderActivityIcon(activity.taskType)}</div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <span className="text-sm font-semibold text-[#112119]">
                                {activity.title}
                              </span>
                              {activity.urgency === 'overdue' && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-[#B91C1C]">
                                  <AlertCircle className="w-3 h-3" />
                                  Overdue {activity.daysOverdue}d
                                </span>
                              )}
                              {activity.urgency === 'due_today' && (
                                <span className="text-xs font-medium text-[#B45309]">
                                  Due today
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-[#4B5E55] mt-1 leading-relaxed">
                              {activity.subtitle}
                            </p>

                            {/* Zero-Pill Unboxed Metadata Line */}
                            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#64786E]">
                              <span className="font-medium text-[#30433A]">
                                {typeLabel(activity.taskType)}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{activity.zoneOrDetail}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">{activity.cadenceLabel}</span>
                              <span aria-hidden="true">·</span>
                              <span>
                                Assigned to{' '}
                                <strong className="font-semibold text-[#112119]">
                                  {activity.assigneeName}
                                </strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {activity.taskType !== 'fish_tank' && !isConfirming && (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmingKey(activity.key);
                                setSignOffNote('');
                              }}
                              className="h-10 px-3 text-xs font-medium text-[#4B5E55] hover:text-[#112119] hover:bg-[#EFF3F0] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Add Note
                            </button>
                          )}
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
                            <Check className="w-3.5 h-3.5" />
                            {isBusy
                              ? 'Saving…'
                              : activity.taskType === 'fish_tank' && !isConfirming
                                ? `Log ${activity.tankStageLabel} Drawdown`
                                : 'Mark Done'}
                          </button>
                        </div>
                      </div>

                      {/* Inline Sign-Off Confirmation Bar (Fish Tank Irrigation Linkage or Optional Note) */}
                      {isConfirming && (
                        <div className="mt-3.5 ml-7.5 pt-3.5 border-t border-[#E6ECE9] space-y-3">
                          {activity.taskType === 'fish_tank' &&
                            activity.linkedPlantNames &&
                            activity.linkedPlantNames.length > 0 && (
                              <label className="flex items-start gap-2.5 text-xs text-[#112119] cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={alsoWaterLinkedBeds}
                                  onChange={(e) => setAlsoWaterLinkedBeds(e.target.checked)}
                                  className="mt-0.5 rounded border-[#94A3B8] text-[#0369A1] focus:ring-[#0369A1]"
                                />
                                <span>
                                  Also mark linked irrigated beds as watered today:{' '}
                                  <strong className="font-semibold">
                                    {activity.linkedPlantNames.join(', ')}
                                  </strong>{' '}
                                  ({formatVolume(activity.waterVolumeLiters || 0, farm.volumeUnit)} discharged)
                                </span>
                              </label>
                            )}

                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={signOffNote}
                              onChange={(e) => setSignOffNote(e.target.value)}
                              maxLength={300}
                              placeholder="Optional field note (e.g., soil moisture, refill confirmed)…"
                              className="flex-1 min-w-[200px] h-10 px-3 text-xs bg-[#F8FAF9] border border-[#D4DDD8] rounded-lg text-[#112119] placeholder:text-[#7A8E84] focus:outline-none focus:border-[#14532D]"
                            />
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleQuickSignOff(activity)}
                              className="h-10 px-4 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              {isBusy ? 'Logging…' : 'Confirm Sign-Off'}
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

          {/* Completed For Day Section */}
          {completedActivities.length > 0 && (
            <div className="bg-white border border-[#E2E8E5] rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#EDF1EE] flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-[#15803D]">
                  Signed Off for {isToday ? 'Today' : formatReadableDate(selectedDate)} ({completedActivities.length})
                </h3>
              </div>
              <div className="divide-y divide-[#EDF1EE]">
                {completedActivities.map((activity) => (
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
                          <span>Assigned: {activity.assigneeName}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            Done by{' '}
                            <strong className="font-medium text-[#30433A]">
                              {activity.completionLog?.completedByName || activity.assigneeName}
                            </strong>
                          </span>
                          {activity.completionLog?.notes && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="italic">{activity.completionLog.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {activity.completionLog && (
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

        {/* Right Operations Rail: Fish Tank Cycle Pulse + Crew Progress */}
        <div className="xl:col-span-4 space-y-5">
          {/* Fish Tank 1/4 -> 2/4 -> 3/4 Cycle Summary */}
          <div className="bg-white border border-[#E2E8E5] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#EDF1EE] flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-[#112119]">
                Fish Tank Drawdown Cycle
              </h3>
              <button
                type="button"
                onClick={onJumpToFishTanks}
                className="text-xs font-medium text-[#0369A1] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                Manage Tanks
              </button>
            </div>

            {fishTanks.length === 0 ? (
              <div className="p-5 text-xs text-[#64786E]">
                No fish tanks configured yet. Add a tank to schedule 1/4, 2/4, and 3/4 irrigation drawdowns.
              </div>
            ) : (
              <div className="divide-y divide-[#EDF1EE]">
                {fishTanks.map((tank) => {
                  const stageLabel = stageToLabel(tank.currentStage);
                  const discharge = getStageDischargeLiters(tank.capacityLiters, tank.currentStage);
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
                          Next: {stageLabel}
                        </span>
                      </div>

                      {/* 3-Step Visual Cycle Meter */}
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
                              <div className="font-mono text-xs font-semibold tabular-nums">
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
                          Due{' '}
                          <strong className="font-mono font-medium text-[#112119] tabular-nums">
                            {tank.nextDrawdownDate === todayDate
                              ? 'Today'
                              : formatReadableDate(tank.nextDrawdownDate)}
                          </strong>
                        </span>
                        <span className="font-mono text-[#0369A1] font-medium tabular-nums">
                          {formatVolume(discharge, farm.volumeUnit)} → beds
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Crew Daily Completion Breakdown */}
          <div className="bg-white border border-[#E2E8E5] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#EDF1EE]">
              <h3 className="font-display text-sm font-semibold text-[#112119]">
                Crew Sign-Off Progress
              </h3>
              <p className="text-xs text-[#64786E] mt-0.5">
                Click any person to filter their tasks
              </p>
            </div>
            <div className="divide-y divide-[#EDF1EE]">
              {crewProgress.map(({ member, total, done }) => {
                const pct = total > 0 ? Math.round((done / total) * 100) : 100;
                const isSelected = selectedMemberFilter === member.id;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() =>
                      onSelectMemberFilter(isSelected ? 'all' : member.id)
                    }
                    className={`w-full text-left px-5 py-3.5 transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#EEF6F0]' : 'hover:bg-[#FAFDFB]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-[#112119]">{member.name}</span>
                      <span className="font-mono tabular-nums text-[#4B5E55]">
                        {done}/{total} done
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#E6ECE9] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#15803D] transition-all duration-200"
                        style={{ width: `${total === 0 ? 0 : pct}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-[#64786E] mt-1 truncate">
                      {member.specialty || (member.role === 'manager' ? 'Farm Manager' : 'Field Crew')}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
