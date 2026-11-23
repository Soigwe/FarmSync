import { useMemo, useState } from 'react';
import {
  Droplets,
  Edit3,
  Layers,
  Plus,
  Scissors,
  Search,
  Sprout,
  Trash2,
} from 'lucide-react';
import type {
  Farm,
  FarmMember,
  PlantCategory,
  PlantSchedule,
  ScheduledActivity,
} from '../types';
import {
  diffDays,
  formatReadableDate,
  getMemberName,
  getNextCareDueDate,
} from '../utils/schedule';

interface PlantsCareViewProps {
  farm: Farm;
  todayDate: string;
  plants: PlantSchedule[];
  members: FarmMember[];
  onAddPlant: () => void;
  onEditPlant: (plant: PlantSchedule) => void;
  onDeletePlant: (plantId: string) => Promise<void>;
  onQuickLogPlantCare: (
    activity: ScheduledActivity,
    options: { note: string; alsoWaterLinkedBeds: boolean; actingMemberName: string }
  ) => Promise<void>;
}

const CROP_BANNER_IMG = '/src/assets/images/crop_beds_mulch_1795425786373.jpg';

export function PlantsCareView({
  todayDate,
  plants,
  members,
  onAddPlant,
  onEditPlant,
  onDeletePlant,
  onQuickLogPlantCare,
}: PlantsCareViewProps) {
  const [bannerError, setBannerError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | PlantCategory>('all');
  const [fishWaterOnly, setFishWaterOnly] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const filteredPlants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return plants.filter((p) => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (fishWaterOnly && !p.receivesFishWater) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.zone.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [plants, searchQuery, categoryFilter, fishWaterOnly]);

  const handleQuickLog = async (plant: PlantSchedule, type: 'water' | 'mulch' | 'prune') => {
    const key = `${plant.id}:${type}`;
    setBusyKey(key);
    try {
      const assigneeId =
        type === 'water'
          ? plant.waterAssigneeId
          : type === 'mulch'
            ? plant.mulchAssigneeId
            : plant.pruneAssigneeId;
      const assigneeUid =
        type === 'water'
          ? plant.waterAssigneeUid
          : type === 'mulch'
            ? plant.mulchAssigneeUid
            : plant.pruneAssigneeUid;
      const assigneeName = getMemberName(members, assigneeId);
      const verb = type === 'water' ? 'Water' : type === 'mulch' ? 'Add mulch to' : 'Prune';

      await onQuickLogPlantCare(
        {
          key: `${type}:${plant.id}:${todayDate}`,
          taskType: type,
          sourceId: plant.id,
          title: `${verb} ${plant.name}`,
          subtitle: 'Logged from Plants & Crop Care matrix',
          zoneOrDetail: plant.zone,
          dueDate: todayDate,
          daysOverdue: 0,
          urgency: 'due_today',
          assigneeId,
          assigneeName,
          assigneeUid,
          isDoneForDay: false,
          cadenceLabel: '',
        },
        {
          note: '',
          alsoWaterLinkedBeds: false,
          actingMemberName: assigneeName,
        }
      );
    } finally {
      setBusyKey(null);
    }
  };

  const renderCareCell = (
    plant: PlantSchedule,
    type: 'water' | 'mulch' | 'prune',
    enabled: boolean,
    everyDays: number,
    lastDate: string,
    assigneeId: string
  ) => {
    if (!enabled) {
      return <span className="text-xs text-[#94A3B8]">Not scheduled</span>;
    }

    const nextDue = getNextCareDueDate(lastDate, everyDays, todayDate);
    const delta = diffDays(nextDue, todayDate); // > 0 overdue, 0 due today, < 0 upcoming
    const assigneeName = getMemberName(members, assigneeId);
    const key = `${plant.id}:${type}`;
    const isBusy = busyKey === key;

    let statusText = `In ${Math.abs(delta)}d · ${formatReadableDate(nextDue)}`;
    let statusClass = 'text-[#4B5E55]';
    if (lastDate === todayDate) {
      statusText = 'Done today';
      statusClass = 'text-[#15803D] font-semibold';
    } else if (delta > 0) {
      statusText = `Overdue ${delta}d`;
      statusClass = 'text-[#B91C1C] font-semibold';
    } else if (delta === 0) {
      statusText = 'Due today';
      statusClass = 'text-[#B45309] font-semibold';
    }

    const actionIcon =
      type === 'water' ? (
        <Droplets className="w-3 h-3" />
      ) : type === 'mulch' ? (
        <Layers className="w-3 h-3" />
      ) : (
        <Scissors className="w-3 h-3" />
      );

    return (
      <div className="space-y-1">
        <div className={`text-xs font-mono tabular-nums ${statusClass}`}>{statusText}</div>
        <div className="text-[11px] text-[#64786E]">
          Every {everyDays}d · {assigneeName}
        </div>
        {lastDate !== todayDate && (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleQuickLog(plant, type)}
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#14532D] hover:underline disabled:opacity-50 cursor-pointer"
          >
            {actionIcon}
            {isBusy ? 'Logging…' : 'Mark done today'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Documentary Crop Care Banner */}
      <div className="relative rounded-xl overflow-hidden bg-[#13291E] border border-[#DCE4DF] min-h-[176px] flex items-end">
        {!bannerError ? (
          <img
            src={CROP_BANNER_IMG}
            alt="Raised vegetable beds with straw mulch, drip lines, and pruning shears"
            referrerPolicy="no-referrer"
            onError={() => setBannerError(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-[#14532D] to-[#1E3A2F]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A1811]/90 via-[#0A1811]/45 to-[#0A1811]/20" />
        <div className="relative z-10 w-full p-6 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-bold text-white tracking-tight">
              Plants &amp; Crop Care Schedules
            </h2>
            <p className="text-sm text-white/85 mt-1.5 leading-relaxed">
              Configure independent watering, mulching, and pruning cadences for every bed,
              assign each duty to a crew member, and flag beds irrigated with fish tank effluent.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddPlant}
            className="h-10 px-4 text-xs font-semibold text-[#14532D] bg-white hover:bg-[#F0FDF4] rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Plant / Bed
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-[#E2E8E5] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-[#7A8E84] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search plant name or zone…"
            className="w-full h-10 pl-9 pr-3 text-xs bg-[#F8FAF9] border border-[#DCE4DF] rounded-lg text-[#112119] placeholder:text-[#7A8E84] focus:outline-none focus:border-[#14532D]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[#F2F5F3] p-1 rounded-lg overflow-x-auto">
            {(['all', 'vegetable', 'herb', 'fruit', 'orchard', 'nursery'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-white text-[#112119] shadow-xs'
                    : 'text-[#52665C] hover:text-[#112119]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setFishWaterOnly((v) => !v)}
            className={`h-9 px-3 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              fishWaterOnly
                ? 'bg-[#E0F2FE] border-[#7DD3FC] text-[#0C4A6E]'
                : 'bg-white border-[#DCE4DF] text-[#4B5E55] hover:bg-[#F3F6F4]'
            }`}
          >
            Fish-Water Irrigated Only
          </button>
        </div>
      </div>

      {/* High-Density Crop Matrix Table */}
      <div className="bg-white border border-[#E2E8E5] rounded-xl overflow-hidden">
        {filteredPlants.length === 0 ? (
          <div className="p-12 text-center">
            <Sprout className="w-8 h-8 text-[#15803D] mx-auto mb-3" />
            <h3 className="font-display text-base font-semibold text-[#112119] mb-1">
              No matching crop beds found
            </h3>
            <p className="text-xs text-[#64786E] mb-4">
              Adjust your search filter or add a new plant bed with watering, mulching, and pruning schedules.
            </p>
            <button
              type="button"
              onClick={onAddPlant}
              className="h-10 px-4 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              Add Plant / Bed
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[820px]">
              <thead>
                <tr className="border-b border-[#E6ECE9] bg-[#FAFDFB] text-[11px] font-semibold text-[#5A6E64]">
                  <th className="py-3.5 px-5">Plant / Crop Bed</th>
                  <th className="py-3.5 px-4">Watering Schedule</th>
                  <th className="py-3.5 px-4">Mulching Schedule</th>
                  <th className="py-3.5 px-4">Pruning Schedule</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF1EE]">
                {filteredPlants.map((plant) => (
                  <tr key={plant.id} className="hover:bg-[#FAFDFB] transition-colors align-top">
                    <td className="py-4 px-5 max-w-[260px]">
                      <div className="text-sm font-semibold text-[#112119]">{plant.name}</div>
                      <div className="text-xs text-[#64786E] mt-0.5 capitalize">
                        {plant.zone} · {plant.category}
                      </div>
                      {plant.receivesFishWater && (
                        <div className="text-[11px] font-medium text-[#0369A1] mt-1">
                          Receives fish tank effluent water
                        </div>
                      )}
                      {plant.notes && (
                        <p className="text-[11px] text-[#64786E] mt-1.5 line-clamp-2 leading-relaxed">
                          {plant.notes}
                        </p>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      {renderCareCell(
                        plant,
                        'water',
                        plant.waterEnabled,
                        plant.waterEveryDays,
                        plant.lastWateredDate,
                        plant.waterAssigneeId
                      )}
                    </td>

                    <td className="py-4 px-4">
                      {renderCareCell(
                        plant,
                        'mulch',
                        plant.mulchEnabled,
                        plant.mulchEveryDays,
                        plant.lastMulchedDate,
                        plant.mulchAssigneeId
                      )}
                    </td>

                    <td className="py-4 px-4">
                      {renderCareCell(
                        plant,
                        'prune',
                        plant.pruneEnabled,
                        plant.pruneEveryDays,
                        plant.lastPrunedDate,
                        plant.pruneAssigneeId
                      )}
                    </td>

                    <td className="py-4 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onEditPlant(plant)}
                          className="h-9 px-3 text-xs font-medium text-[#30433A] border border-[#DCE4DF] hover:bg-[#F3F6F4] rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDeletePlant(plant.id)}
                          aria-label={`Delete ${plant.name}`}
                          className="h-9 w-9 inline-flex items-center justify-center text-[#64786E] hover:text-[#B91C1C] hover:bg-[#FEF2F2] rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
