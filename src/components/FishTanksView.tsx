import { useState } from 'react';
import { Check, Droplets, Edit3, Fish, Plus, Trash2 } from 'lucide-react';
import type { Farm, FarmMember, FishTank, PlantSchedule, ScheduledActivity } from '../types';
import {
  buildTankForecast,
  formatReadableDate,
  formatVolume,
  getMemberName,
  getStageDischargeLiters,
  stageToLabel,
} from '../utils/schedule';
import { TankLevelVisual } from './TankLevelVisual';

interface FishTanksViewProps {
  farm: Farm;
  todayDate: string;
  fishTanks: FishTank[];
  plants: PlantSchedule[];
  members: FarmMember[];
  onAddTank: () => void;
  onEditTank: (tank: FishTank) => void;
  onDeleteTank: (tankId: string) => Promise<void>;
  onCompleteDrawdown: (
    activity: ScheduledActivity,
    options: { note: string; alsoWaterLinkedBeds: boolean; actingMemberName: string }
  ) => Promise<void>;
}

const TANK_BANNER_IMG = '/src/assets/images/fish_tank_aquaculture_1795425745482.jpg';

export function FishTanksView({
  farm,
  todayDate,
  fishTanks,
  plants,
  members,
  onAddTank,
  onEditTank,
  onDeleteTank,
  onCompleteDrawdown,
}: FishTanksViewProps) {
  const [bannerError, setBannerError] = useState(false);
  const [alsoWaterBeds, setAlsoWaterBeds] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

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
        taskType: 'fish_tank',
        sourceId: tank.id,
        title: `${tank.name} — reduce by ${stageLabel}`,
        subtitle: `Irrigate ${linkedNames.join(', ') || 'crop beds'}`,
        zoneOrDetail: tank.species,
        dueDate: tank.nextDrawdownDate,
        daysOverdue: 0,
        urgency: 'due_today',
        assigneeId: tank.assigneeId,
        assigneeName,
        assigneeUid: tank.assigneeUid,
        isDoneForDay: false,
        tankStage: tank.currentStage,
        tankStageLabel: stageLabel,
        waterVolumeLiters: dischargeLiters,
        linkedPlantIds: tank.irrigationBedIds,
        linkedPlantNames: linkedNames,
        cadenceLabel: `Every ${tank.intervalDays}d`,
      };

      await onCompleteDrawdown(activity, {
        note: '',
        alsoWaterLinkedBeds: alsoWaterBeds[tank.id] ?? true,
        actingMemberName: assigneeName,
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Documentary Aquaculture Banner */}
      <div className="relative rounded-xl overflow-hidden bg-[#0F2A38] border border-[#DCE4DF] min-h-[188px] flex items-end">
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
        <div className="absolute inset-0 bg-gradient-to-t from-[#081A24]/90 via-[#081A24]/50 to-[#081A24]/20" />
        <div className="relative z-10 w-full p-6 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-bold text-white tracking-tight">
              Fish Tank Drawdown &amp; Effluent Irrigation
            </h2>
            <p className="text-sm text-white/85 mt-1.5 leading-relaxed">
              Automated 6-day stepped drawdown schedule: reduce by 1/4 after 2 days, 2/4 after
              another 2 days, and 3/4 after another 2 days with full refill — routing every liter
              of nutrient-rich water straight into linked crop beds.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddTank}
            className="h-10 px-4 text-xs font-semibold text-[#0C4A6E] bg-white hover:bg-[#F0F9FF] rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Fish Tank
          </button>
        </div>
      </div>

      {fishTanks.length === 0 ? (
        <div className="bg-white border border-[#E2E8E5] rounded-xl p-12 text-center">
          <Fish className="w-8 h-8 text-[#0369A1] mx-auto mb-3" />
          <h3 className="font-display text-base font-semibold text-[#112119] mb-1">
            No fish tanks scheduled yet
          </h3>
          <p className="text-sm text-[#5A6E64] max-w-md mx-auto mb-5">
            Add your aquaculture tank capacity, drawdown interval (default 2 days), assigned worker,
            and linked irrigation beds.
          </p>
          <button
            type="button"
            onClick={onAddTank}
            className="h-10 px-4 text-sm font-medium text-white bg-[#14532D] hover:bg-[#0F3F22] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            Add First Fish Tank
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {fishTanks.map((tank) => {
            const stageLabel = stageToLabel(tank.currentStage);
            const dischargeLiters = getStageDischargeLiters(tank.capacityLiters, tank.currentStage);
            const assigneeName = getMemberName(members, tank.assigneeId);
            const linkedBeds = plants.filter((p) => tank.irrigationBedIds.includes(p.id));
            const forecast = buildTankForecast(tank, 6);
            const isDue = tank.nextDrawdownDate <= todayDate;
            const checkedBeds = alsoWaterBeds[tank.id] ?? true;

            return (
              <div
                key={tank.id}
                className="bg-white border border-[#E2E8E5] rounded-xl overflow-hidden"
              >
                {/* Header Row */}
                <div className="px-6 py-4 border-b border-[#EDF1EE] flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                      <h3 className="font-display text-lg font-bold text-[#112119]">{tank.name}</h3>
                      <span className="text-xs text-[#5A6E64]">
                        {tank.species} ·{' '}
                        <span className="font-mono tabular-nums">
                          {formatVolume(tank.capacityLiters, farm.volumeUnit)}
                        </span>{' '}
                        capacity · Every {tank.intervalDays} days
                      </span>
                    </div>
                    <div className="text-xs text-[#64786E] mt-1">
                      Assigned operator:{' '}
                      <strong className="font-semibold text-[#112119]">{assigneeName}</strong>
                      {' · '}
                      Last drawdown:{' '}
                      <span className="font-mono tabular-nums">
                        {tank.lastDrawdownDate ? formatReadableDate(tank.lastDrawdownDate) : 'None yet'}
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
                    <button
                      type="button"
                      onClick={() => void onDeleteTank(tank.id)}
                      aria-label={`Delete ${tank.name}`}
                      className="h-9 w-9 inline-flex items-center justify-center text-[#64786E] hover:text-[#B91C1C] hover:bg-[#FEF2F2] rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Body Grid: Cross-Section Gauge + Active Stage Controls + 6-Cycle Forecast Table */}
                <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#EDF1EE]">
                  {/* Left: Interactive Tank Cross-Section & Current Action */}
                  <div className="lg:col-span-5 p-6 space-y-5">
                    <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-start gap-5">
                      <TankLevelVisual
                        capacityLiters={tank.capacityLiters}
                        currentStage={tank.currentStage}
                        volumeUnit={farm.volumeUnit}
                      />

                      <div className="flex-1 space-y-3 min-w-0">
                        <div>
                          <div className="text-xs font-medium text-[#5A6E64]">Next Scheduled Step</div>
                          <div className="font-display text-xl font-bold text-[#0369A1] mt-0.5 font-mono tabular-nums">
                            Reduce by {stageLabel}
                          </div>
                          <div
                            className={`text-xs font-medium mt-1 ${
                              isDue ? 'text-[#B45309]' : 'text-[#4B5E55]'
                            }`}
                          >
                            {tank.nextDrawdownDate === todayDate
                              ? 'Due today'
                              : tank.nextDrawdownDate < todayDate
                                ? `Overdue since ${formatReadableDate(tank.nextDrawdownDate)}`
                                : `Scheduled for ${formatReadableDate(tank.nextDrawdownDate)}`}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-[#EDF1EE] space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-[#5A6E64]">Irrigation Yield</span>
                            <span className="font-mono font-semibold text-[#112119] tabular-nums">
                              {formatVolume(dischargeLiters, farm.volumeUnit)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#5A6E64]">Post-Stage Action</span>
                            <span className="font-medium text-[#112119]">
                              {tank.currentStage === 3 ? 'Deep flush & full refill' : 'Hold until +2d step'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Linked Irrigation Beds */}
                    <div className="pt-4 border-t border-[#EDF1EE] space-y-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#112119]">
                        <Droplets className="w-3.5 h-3.5 text-[#0369A1]" />
                        <span>Crop Beds Irrigated by This Tank</span>
                      </div>
                      {linkedBeds.length === 0 ? (
                        <p className="text-xs text-[#64786E]">
                          No crop beds linked yet. Edit this tank to select which plants receive discharged water.
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
                            className="rounded border-[#94A3B8] text-[#0369A1] focus:ring-[#0369A1]"
                          />
                          <span>Automatically mark linked beds as watered when logging drawdown</span>
                        </label>
                      )}
                    </div>

                    {tank.notes && (
                      <p className="text-xs text-[#5A6E64] leading-relaxed pt-2 border-t border-[#EDF1EE]">
                        {tank.notes}
                      </p>
                    )}

                    <button
                      type="button"
                      disabled={busyId === tank.id}
                      onClick={() => void handleLogDrawdown(tank)}
                      className="w-full h-11 px-4 text-xs font-semibold text-white bg-[#0369A1] hover:bg-[#075985] disabled:opacity-60 rounded-lg inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      {busyId === tank.id
                        ? 'Recording drawdown & updating cycle…'
                        : `Complete ${stageLabel} Drawdown (${formatVolume(dischargeLiters, farm.volumeUnit)}) & Advance Cycle`}
                    </button>
                  </div>

                  {/* Right: 6-Step Upcoming Drawdown & Irrigation Forecast Table */}
                  <div className="lg:col-span-7 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-display text-sm font-semibold text-[#112119]">
                          Upcoming 6-Step Drawdown Rotation
                        </h4>
                        <p className="text-xs text-[#64786E] mt-0.5">
                          Repeating 1/4 → 2/4 → 3/4 every {tank.intervalDays} days
                        </p>
                      </div>
                      <span className="font-mono text-xs text-[#0369A1] tabular-nums">
                        {formatVolume(
                          forecast.reduce((sum, r) => sum + r.dischargeLiters, 0),
                          farm.volumeUnit
                        )}{' '}
                        projected
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#E6ECE9] text-[11px] font-medium text-[#64786E]">
                            <th className="py-2.5 pr-3">Scheduled Date</th>
                            <th className="py-2.5 px-3">Drawdown Stage</th>
                            <th className="py-2.5 px-3 text-right">Water for Irrigation</th>
                            <th className="py-2.5 px-3 text-right">Tank Remaining</th>
                            <th className="py-2.5 pl-3">Refill Note</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F0F4F1] text-xs">
                          {forecast.map((row, idx) => (
                            <tr
                              key={`${row.dateKey}-${idx}`}
                              className={idx === 0 ? 'bg-[#F0F9FF]/70 font-medium' : 'hover:bg-[#FAFDFB]'}
                            >
                              <td className="py-3 pr-3 font-mono tabular-nums text-[#112119] whitespace-nowrap">
                                {formatReadableDate(row.dateKey)}
                                {idx === 0 && (
                                  <span className="ml-2 font-sans text-[11px] font-semibold text-[#0369A1]">
                                    Next
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 font-mono tabular-nums font-semibold text-[#0C4A6E]">
                                {row.stageLabel} reduction
                              </td>
                              <td className="py-3 px-3 text-right font-mono tabular-nums text-[#112119]">
                                {formatVolume(row.dischargeLiters, farm.volumeUnit)}
                              </td>
                              <td className="py-3 px-3 text-right font-mono tabular-nums text-[#5A6E64]">
                                {row.remainingPercent}%
                              </td>
                              <td className="py-3 pl-3 text-[#4B5E55] whitespace-nowrap">
                                {row.includesRefill
                                  ? 'Full fresh water refill after discharge'
                                  : 'Continue to next +2d step'}
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
  );
}
