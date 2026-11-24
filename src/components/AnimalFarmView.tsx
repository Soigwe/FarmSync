import { useMemo, useState } from 'react';
import {
  Check,
  Droplets,
  Edit3,
  Fish,
  PawPrint,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  ANIMAL_TASK_KIND_LABELS,
  ANIMAL_TYPE_LABELS,
  type AnimalGroup,
  type AnimalTask,
  type AnimalType,
  type Farm,
  type FarmMember,
  type FishTank,
  type PlantSchedule,
  type ScheduledActivity,
} from '../types';
import {
  buildTankForecast,
  diffDays,
  formatReadableDate,
  formatVolume,
  getMemberName,
  getNextCareDueDate,
  getStageDischargeLiters,
  stageToLabel,
} from '../utils/schedule';
import { TankLevelVisual } from './TankLevelVisual';

interface AnimalFarmViewProps {
  farm: Farm;
  todayDate: string;
  fishTanks: FishTank[];
  animals: AnimalGroup[];
  animalTasks: AnimalTask[];
  plants: PlantSchedule[];
  members: FarmMember[];
  onAddTank: () => void;
  onEditTank: (tank: FishTank) => void;
  onDeleteTank: (tankId: string) => Promise<void>;
  onAddAnimal: () => void;
  onEditAnimal: (animal: AnimalGroup) => void;
  onDeleteAnimal: (animal: AnimalGroup) => Promise<void>;
  onAddAnimalTask: (defaultAnimal?: AnimalGroup) => void;
  onEditAnimalTask: (task: AnimalTask) => void;
  onDeleteAnimalTask: (taskId: string) => Promise<void>;
  onCompleteActivity: (
    activity: ScheduledActivity,
    options: { note: string; alsoWaterLinkedBeds: boolean; actingMemberName: string }
  ) => Promise<void>;
}

const TANK_BANNER_IMG = '/src/assets/images/fish_tank_aquaculture_1795425745482.jpg';

export function AnimalFarmView({
  farm,
  todayDate,
  fishTanks,
  animals,
  animalTasks,
  plants,
  members,
  onAddTank,
  onEditTank,
  onDeleteTank,
  onAddAnimal,
  onEditAnimal,
  onDeleteAnimal,
  onAddAnimalTask,
  onEditAnimalTask,
  onDeleteAnimalTask,
  onCompleteActivity,
}: AnimalFarmViewProps) {
  const [bannerError, setBannerError] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | AnimalType>('all');
  const [alsoWaterBeds, setAlsoWaterBeds] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const presentTypes = useMemo(() => {
    const base: AnimalType[] = ['fish', 'chicken', 'duck'];
    const extras = new Set<AnimalType>();
    for (const a of animals) {
      if (!base.includes(a.animalType)) extras.add(a.animalType);
    }
    return [...base, ...Array.from(extras)];
  }, [animals]);

  const showFishTanks = typeFilter === 'all' || typeFilter === 'fish';
  const filteredAnimals = useMemo(() => {
    if (typeFilter === 'all') return animals;
    return animals.filter((a) => a.animalType === typeFilter);
  }, [animals, typeFilter]);

  const orphanTasks = useMemo(() => {
    const animalIds = new Set(animals.map((a) => a.id));
    return animalTasks.filter(
      (t) => !animalIds.has(t.animalId) && (typeFilter === 'all' || t.animalType === typeFilter)
    );
  }, [animals, animalTasks, typeFilter]);

  const handleLogDrawdown = async (tank: FishTank) => {
    setBusyId(tank.id);
    try {
      const stageLabel = stageToLabel(tank.currentStage);
      const dischargeLiters = getStageDischargeLiters(tank.capacityLiters, tank.currentStage);
      const assigneeName = getMemberName(members, tank.assigneeId);
      const linkedNames = tank.irrigationBedIds
        .map((id) => plants.find((p) => p.id === id)?.name)
        .filter((n): n is string => Boolean(n));

      const activity: ScheduledActivity = {
        key: `fish_tank:${tank.id}:${todayDate}`,
        farmArea: 'animals',
        taskType: 'fish_tank',
        sourceId: tank.id,
        title: `${tank.name} — drain ${stageLabel}`,
        subtitle: `Irrigate ${linkedNames.join(', ') || 'crop beds'}`,
        zoneOrDetail: `Fish · ${tank.species}`,
        dueDate: tank.nextDrawdownDate,
        daysOverdue: 0,
        urgency: 'due_today',
        assigneeId: tank.assigneeId,
        assigneeName,
        assigneeUid: tank.assigneeUid,
        isDoneForDay: false,
        isPendingConfirmation: false,
        animalType: 'fish',
        tankStage: tank.currentStage,
        tankStageLabel: stageLabel,
        waterVolumeLiters: dischargeLiters,
        linkedPlantIds: tank.irrigationBedIds,
        linkedPlantNames: linkedNames,
        cadenceLabel: `Every ${tank.intervalDays}d`,
      };

      await onCompleteActivity(activity, {
        note: '',
        alsoWaterLinkedBeds: alsoWaterBeds[tank.id] ?? true,
        actingMemberName: assigneeName,
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleLogAnimalTask = async (task: AnimalTask) => {
    setBusyId(task.id);
    try {
      const assigneeName = getMemberName(members, task.assigneeId);
      const activity: ScheduledActivity = {
        key: `animal:${task.id}:${todayDate}`,
        farmArea: 'animals',
        taskType: 'animal',
        sourceId: task.id,
        title: `${task.title} — ${task.animalName}`,
        subtitle: task.notes || ANIMAL_TASK_KIND_LABELS[task.taskKind],
        zoneOrDetail: `${ANIMAL_TYPE_LABELS[task.animalType]} · ${ANIMAL_TASK_KIND_LABELS[task.taskKind]}`,
        dueDate: todayDate,
        daysOverdue: 0,
        urgency: 'due_today',
        assigneeId: task.assigneeId,
        assigneeName,
        assigneeUid: task.assigneeUid,
        isDoneForDay: false,
        isPendingConfirmation: false,
        animalType: task.animalType,
        animalTaskKind: task.taskKind,
        cadenceLabel: task.everyDays === 1 ? 'Daily' : `Every ${task.everyDays}d`,
      };

      await onCompleteActivity(activity, {
        note: '',
        alsoWaterLinkedBeds: false,
        actingMemberName: assigneeName,
      });
    } finally {
      setBusyId(null);
    }
  };

  const renderTaskRow = (task: AnimalTask) => {
    const nextDue = getNextCareDueDate(task.lastDoneDate, task.everyDays, todayDate);
    const delta = diffDays(nextDue, todayDate);
    const assigneeName = getMemberName(members, task.assigneeId);
    const doneToday = task.lastDoneDate === todayDate;
    const isBusy = busyId === task.id;
    const confirmingDelete = confirmDeleteId === `atask:${task.id}`;

    let statusText = `In ${Math.abs(delta)}d · ${formatReadableDate(nextDue)}`;
    let statusClass = 'text-[#4B5E55]';
    if (doneToday) {
      statusText = 'Done today';
      statusClass = 'text-[#15803D] font-semibold';
    } else if (delta > 0) {
      statusText = `Late by ${delta}d`;
      statusClass = 'text-[#B91C1C] font-semibold';
    } else if (delta === 0) {
      statusText = 'Due today';
      statusClass = 'text-[#B45309] font-semibold';
    }

    return (
      <div
        key={task.id}
        className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAFDFB] transition-colors"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <span className="text-sm font-semibold text-[#112119]">{task.title}</span>
            <span className={`text-xs font-mono tabular-nums ${statusClass}`}>{statusText}</span>
          </div>
          <div className="text-xs text-[#64786E] mt-0.5 flex flex-wrap items-center gap-x-2">
            <span>{ANIMAL_TASK_KIND_LABELS[task.taskKind]}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {task.everyDays === 1 ? 'Every day' : `Every ${task.everyDays} days`}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Person: <strong className="font-medium text-[#112119]">{assigneeName}</strong>
            </span>
          </div>
          {task.notes && (
            <p className="text-xs text-[#5A6E64] mt-1 leading-relaxed">{task.notes}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!doneToday && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleLogAnimalTask(task)}
              className="h-9 px-3.5 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] disabled:opacity-60 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              {isBusy ? 'Saving…' : 'Mark Done'}
            </button>
          )}
          <button
            type="button"
            onClick={() => onEditAnimalTask(task)}
            aria-label={`Edit ${task.title}`}
            className="h-9 px-2.5 text-xs font-medium text-[#30433A] border border-[#DCE4DF] hover:bg-[#F3F6F4] rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit
          </button>

          {confirmingDelete ? (
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={async () => {
                  await onDeleteAnimalTask(task.id);
                  setConfirmDeleteId(null);
                }}
                className="h-9 px-2.5 text-xs font-semibold text-white bg-[#B91C1C] hover:bg-[#991B1B] rounded-lg cursor-pointer"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="h-9 px-2 text-xs text-[#5A6E64] hover:text-[#112119] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDeleteId(`atask:${task.id}`)}
              aria-label={`Delete ${task.title}`}
              className="h-9 w-9 inline-flex items-center justify-center text-[#64786E] hover:text-[#B91C1C] hover:bg-[#FEF2F2] rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Documentary Animal Farm Banner */}
      <div className="relative rounded-xl overflow-hidden bg-[#0F2A38] border border-[#DCE4DF] min-h-[184px] flex items-end">
        {!bannerError ? (
          <img
            src={TANK_BANNER_IMG}
            alt="Farm aquaculture fish tank connected to vegetable bed irrigation manifold"
            referrerPolicy="no-referrer"
            onError={() => setBannerError(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-[#0C4A6E] to-[#134E4A]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#081A24]/92 via-[#081A24]/55 to-[#081A24]/20" />
        <div className="relative z-10 w-full p-6 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-bold text-white tracking-tight">
              Animal Farm
            </h2>
            <p className="text-sm text-white/85 mt-1.5 leading-relaxed">
              Manage fish tank 1/4 → 2/4 → 3/4 water changes alongside feeding, cleaning, and daily
              care for your fish, chickens, ducks, and other animals.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onAddAnimal}
              className="h-10 px-4 text-xs font-semibold text-[#14532D] bg-white hover:bg-[#F0FDF4] rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Animal Group
            </button>
            <button
              type="button"
              onClick={onAddTank}
              className="h-10 px-4 text-xs font-semibold text-white bg-[#0369A1] hover:bg-[#075985] rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Fish className="w-4 h-4" />
              Add Fish Tank
            </button>
          </div>
        </div>
      </div>

      {/* Animal Type Switcher Bar */}
      <div className="bg-white border border-[#E2E8E5] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            className={`h-10 px-3.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              typeFilter === 'all'
                ? 'bg-[#112119] text-white'
                : 'bg-[#F2F5F3] text-[#3D5247] hover:bg-[#E5ECE8]'
            }`}
          >
            All Animals ({animals.length + fishTanks.length})
          </button>
          {presentTypes.map((t) => {
            const count =
              animals.filter((a) => a.animalType === t).length +
              (t === 'fish' ? fishTanks.length : 0);
            const active = typeFilter === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`h-10 px-3.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? t === 'fish'
                      ? 'bg-[#0369A1] text-white'
                      : 'bg-[#14532D] text-white'
                    : 'bg-[#F2F5F3] text-[#3D5247] hover:bg-[#E5ECE8]'
                }`}
              >
                {ANIMAL_TYPE_LABELS[t]} ({count})
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onAddAnimalTask()}
          className="h-10 px-3.5 text-xs font-semibold text-[#14532D] border border-[#DCE4DF] hover:bg-[#EEF6F0] rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Animal Task
        </button>
      </div>

      {/* Section 1: Fish Tank Stepped Water Changes (1/4 -> 2/4 -> 3/4) */}
      {showFishTanks && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-base font-bold text-[#112119]">
                Fish Tank Water Changes (1/4 → 2/4 → 3/4)
              </h3>
              <p className="text-xs text-[#5A6E64] mt-0.5">
                Drain fish water every 2 days and route it directly to your linked crop beds.
              </p>
            </div>
            <button
              type="button"
              onClick={onAddTank}
              className="h-9 px-3 text-xs font-semibold text-[#0369A1] hover:bg-[#F0F9FF] rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Tank
            </button>
          </div>

          {fishTanks.length === 0 ? (
            <div className="bg-white border border-[#E2E8E5] rounded-xl p-8 text-center">
              <Fish className="w-7 h-7 text-[#0369A1] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#112119]">No fish tanks added yet</p>
              <p className="text-xs text-[#5A6E64] mt-1 mb-4">
                Add a tank to track your 1/4, 2/4, and 3/4 water reductions for plant irrigation.
              </p>
              <button
                type="button"
                onClick={onAddTank}
                className="h-9 px-4 text-xs font-semibold text-white bg-[#0369A1] hover:bg-[#075985] rounded-lg cursor-pointer"
              >
                Add Fish Tank
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {fishTanks.map((tank) => {
                const stageLabel = stageToLabel(tank.currentStage);
                const dischargeLiters = getStageDischargeLiters(
                  tank.capacityLiters,
                  tank.currentStage
                );
                const assigneeName = getMemberName(members, tank.assigneeId);
                const linkedBeds = plants.filter((p) => tank.irrigationBedIds.includes(p.id));
                const forecast = buildTankForecast(tank, 6);
                const isDue = tank.nextDrawdownDate <= todayDate;
                const checkedBeds = alsoWaterBeds[tank.id] ?? true;
                const confirmingDelete = confirmDeleteId === `tank:${tank.id}`;

                return (
                  <div
                    key={tank.id}
                    className="bg-white border border-[#E2E8E5] rounded-xl overflow-hidden"
                  >
                    <div className="px-6 py-4 border-b border-[#EDF1EE] flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                          <h4 className="font-display text-lg font-bold text-[#112119]">
                            {tank.name}
                          </h4>
                          <span className="text-xs text-[#5A6E64]">
                            {tank.species} ·{' '}
                            <span className="font-mono tabular-nums">
                              {formatVolume(tank.capacityLiters, farm.volumeUnit)}
                            </span>{' '}
                            · Every {tank.intervalDays} days
                          </span>
                        </div>
                        <div className="text-xs text-[#64786E] mt-1">
                          Person:{' '}
                          <strong className="font-semibold text-[#112119]">{assigneeName}</strong>
                          {' · '}
                          Last water change:{' '}
                          <span className="font-mono tabular-nums">
                            {tank.lastDrawdownDate
                              ? formatReadableDate(tank.lastDrawdownDate)
                              : 'None yet'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onEditTank(tank)}
                          className="h-9 px-3 text-xs font-medium text-[#30433A] border border-[#DCE4DF] hover:bg-[#F3F6F4] rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit Tank
                        </button>
                        {confirmingDelete ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={async () => {
                                await onDeleteTank(tank.id);
                                setConfirmDeleteId(null);
                              }}
                              className="h-9 px-3 text-xs font-semibold text-white bg-[#B91C1C] hover:bg-[#991B1B] rounded-lg cursor-pointer"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="h-9 px-2 text-xs text-[#5A6E64] cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(`tank:${tank.id}`)}
                            aria-label={`Delete ${tank.name}`}
                            className="h-9 w-9 inline-flex items-center justify-center text-[#64786E] hover:text-[#B91C1C] hover:bg-[#FEF2F2] rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#EDF1EE]">
                      <div className="lg:col-span-5 p-6 space-y-5">
                        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-start gap-5">
                          <TankLevelVisual
                            capacityLiters={tank.capacityLiters}
                            currentStage={tank.currentStage}
                            volumeUnit={farm.volumeUnit}
                          />

                          <div className="flex-1 space-y-3 min-w-0">
                            <div>
                              <div className="text-xs font-medium text-[#5A6E64]">Next Step</div>
                              <div className="font-display text-xl font-bold text-[#0369A1] mt-0.5 font-mono tabular-nums">
                                Drain {stageLabel}
                              </div>
                              <div
                                className={`text-xs font-medium mt-1 ${
                                  isDue ? 'text-[#B45309]' : 'text-[#4B5E55]'
                                }`}
                              >
                                {tank.nextDrawdownDate === todayDate
                                  ? 'Due today'
                                  : tank.nextDrawdownDate < todayDate
                                    ? `Late since ${formatReadableDate(tank.nextDrawdownDate)}`
                                    : `Next: ${formatReadableDate(tank.nextDrawdownDate)}`}
                              </div>
                            </div>

                            <div className="pt-3 border-t border-[#EDF1EE] space-y-1.5 text-xs">
                              <div className="flex justify-between">
                                <span className="text-[#5A6E64]">Water for Crops</span>
                                <span className="font-mono font-semibold text-[#112119] tabular-nums">
                                  {formatVolume(dischargeLiters, farm.volumeUnit)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#5A6E64]">After Draining</span>
                                <span className="font-medium text-[#112119]">
                                  {tank.currentStage === 3 ? 'Refill full fresh water' : 'Next step in +2d'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-[#EDF1EE] space-y-2.5">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#112119]">
                            <Droplets className="w-3.5 h-3.5 text-[#0369A1]" />
                            <span>Crop Beds Watered by This Tank</span>
                          </div>
                          {linkedBeds.length === 0 ? (
                            <p className="text-xs text-[#64786E]">
                              No crop beds linked yet. Edit this tank to pick which plants use this water.
                            </p>
                          ) : (
                            <div className="text-xs text-[#30433A] leading-relaxed">
                              {linkedBeds.map((b, idx) => (
                                <span key={b.id}>
                                  {idx > 0 && <span className="mx-1.5 text-[#94A3B8]">·</span>}
                                  <span className="font-medium">{b.name}</span>
                                </span>
                              ))}
                            </div>
                          )}

                          {linkedBeds.length > 0 && (
                            <label className="flex items-center gap-2 text-xs text-[#4B5E55] pt-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checkedBeds}
                                onChange={(e) =>
                                  setAlsoWaterBeds((prev) => ({
                                    ...prev,
                                    [tank.id]: e.target.checked,
                                  }))
                                }
                                className="rounded border-[#94A3B8] text-[#0369A1]"
                              />
                              <span>Also mark linked beds watered today</span>
                            </label>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={busyId === tank.id}
                          onClick={() => void handleLogDrawdown(tank)}
                          className="w-full h-11 px-4 text-xs font-semibold text-white bg-[#0369A1] hover:bg-[#075985] disabled:opacity-60 rounded-lg inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          {busyId === tank.id
                            ? 'Saving…'
                            : `Done: Drain ${stageLabel} (${formatVolume(dischargeLiters, farm.volumeUnit)})`}
                        </button>
                      </div>

                      <div className="lg:col-span-7 p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h5 className="font-display text-sm font-semibold text-[#112119]">
                              Next 6 Water Changes
                            </h5>
                            <p className="text-xs text-[#64786E] mt-0.5">
                              Repeats 1/4 → 2/4 → 3/4 every {tank.intervalDays} days
                            </p>
                          </div>
                          <span className="font-mono text-xs text-[#0369A1] tabular-nums">
                            {formatVolume(
                              forecast.reduce((sum, r) => sum + r.dischargeLiters, 0),
                              farm.volumeUnit
                            )}{' '}
                            total
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-[#E6ECE9] text-[11px] font-medium text-[#64786E]">
                                <th className="py-2 pr-3">Date</th>
                                <th className="py-2 px-3">Step</th>
                                <th className="py-2 px-3 text-right">For Plants</th>
                                <th className="py-2 px-3 text-right">Left in Tank</th>
                                <th className="py-2 pl-3">Note</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F0F4F1] text-xs">
                              {forecast.map((row, idx) => (
                                <tr
                                  key={`${row.dateKey}-${idx}`}
                                  className={idx === 0 ? 'bg-[#F0F9FF]/70 font-medium' : 'hover:bg-[#FAFDFB]'}
                                >
                                  <td className="py-2.5 pr-3 font-mono tabular-nums text-[#112119] whitespace-nowrap">
                                    {formatReadableDate(row.dateKey)}
                                    {idx === 0 && (
                                      <span className="ml-2 font-sans text-[11px] font-semibold text-[#0369A1]">
                                        Next
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono tabular-nums font-semibold text-[#0C4A6E]">
                                    {row.stageLabel} drain
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#112119]">
                                    {formatVolume(row.dischargeLiters, farm.volumeUnit)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#5A6E64]">
                                    {row.remainingPercent}%
                                  </td>
                                  <td className="py-2.5 pl-3 text-[#4B5E55] whitespace-nowrap">
                                    {row.includesRefill ? 'Full fresh refill' : 'Hold +2 days'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Section 2: Animal Groups & Tailored Care Tasks (Fish Feeding, Chickens, Ducks, etc.) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-bold text-[#112119]">
              Animal Groups &amp; Care Tasks
            </h3>
            <p className="text-xs text-[#5A6E64] mt-0.5">
              Each animal type has its own feeding, cleaning, egg collection, and health tasks.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddAnimal}
            className="h-9 px-3 text-xs font-semibold text-[#14532D] hover:bg-[#EEF6F0] rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Animal Group
          </button>
        </div>

        {filteredAnimals.length === 0 ? (
          <div className="bg-white border border-[#E2E8E5] rounded-xl p-10 text-center">
            <PawPrint className="w-7 h-7 text-[#15803D] mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#112119]">
              No {typeFilter === 'all' ? 'animal groups' : ANIMAL_TYPE_LABELS[typeFilter].toLowerCase()} added yet
            </p>
            <p className="text-xs text-[#5A6E64] mt-1 mb-4 max-w-md mx-auto">
              Add your fish ponds, chicken coops, duck pens, or livestock to schedule daily feeding,
              cleaning, and checks automatically.
            </p>
            <button
              type="button"
              onClick={onAddAnimal}
              className="h-10 px-4 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] rounded-lg cursor-pointer"
            >
              Add Animal Group
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAnimals.map((group) => {
              const tasksForGroup = animalTasks.filter((t) => t.animalId === group.id);
              const confirmingDelete = confirmDeleteId === `animal:${group.id}`;

              return (
                <div
                  key={group.id}
                  className="bg-white border border-[#E2E8E5] rounded-xl overflow-hidden"
                >
                  <div className="px-5 py-4 border-b border-[#EDF1EE] flex flex-wrap items-center justify-between gap-3 bg-[#FAFDFB]">
                    <div>
                      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                        <h4 className="font-display text-base font-bold text-[#112119]">
                          {group.name}
                        </h4>
                        <span className="text-xs text-[#5A6E64]">
                          {ANIMAL_TYPE_LABELS[group.animalType]}
                          {group.count > 0 ? ` · ${group.count.toLocaleString()} head` : ''}
                          {group.housing ? ` · ${group.housing}` : ''}
                        </span>
                      </div>
                      {group.notes && (
                        <p className="text-xs text-[#64786E] mt-0.5">{group.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onAddAnimalTask(group)}
                        className="h-9 px-3 text-xs font-semibold text-[#14532D] border border-[#C7DBD0] bg-white hover:bg-[#EEF6F0] rounded-lg inline-flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Task
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditAnimal(group)}
                        className="h-9 px-3 text-xs font-medium text-[#30433A] border border-[#DCE4DF] bg-white hover:bg-[#F3F6F4] rounded-lg inline-flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      {confirmingDelete ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={async () => {
                              await onDeleteAnimal(group);
                              setConfirmDeleteId(null);
                            }}
                            className="h-9 px-2.5 text-xs font-semibold text-white bg-[#B91C1C] hover:bg-[#991B1B] rounded-lg cursor-pointer"
                          >
                            Delete Group
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="h-9 px-2 text-xs text-[#5A6E64] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(`animal:${group.id}`)}
                          aria-label={`Delete ${group.name}`}
                          className="h-9 w-9 inline-flex items-center justify-center text-[#64786E] hover:text-[#B91C1C] hover:bg-[#FEF2F2] rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {tasksForGroup.length === 0 ? (
                    <div className="px-5 py-6 text-xs text-[#64786E] flex flex-wrap items-center justify-between gap-3">
                      <span>No care tasks scheduled for {group.name} yet.</span>
                      <button
                        type="button"
                        onClick={() => onAddAnimalTask(group)}
                        className="text-xs font-semibold text-[#14532D] hover:underline cursor-pointer"
                      >
                        + Add first task for {group.name}
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#EDF1EE]">
                      {tasksForGroup.map(renderTaskRow)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {orphanTasks.length > 0 && (
          <div className="bg-white border border-[#E2E8E5] rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#EDF1EE] bg-[#FAFDFB]">
              <h4 className="font-display text-sm font-bold text-[#112119]">Other Animal Tasks</h4>
            </div>
            <div className="divide-y divide-[#EDF1EE]">{orphanTasks.map(renderTaskRow)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
