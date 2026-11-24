import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  ANIMAL_TASK_KIND_LABELS,
  ANIMAL_TASK_PRESETS,
  ANIMAL_TYPE_LABELS,
  SCHEMA_LIMITS,
  type AnimalGroup,
  type AnimalTask,
  type AnimalTaskKind,
  type AnimalTaskPreset,
  type AnimalType,
  type CustomTask,
  type Farm,
  type FarmMember,
  type FishTank,
  type MemberRole,
  type PlantCategory,
  type PlantSchedule,
  type TankStage,
  type TaskCategory,
  type VolumeUnit,
} from '../types';
import { getTodayDateKey, sanitizeInviteCode } from '../utils/schedule';

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-[#0A1811]/55 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-white border border-[#DCE4DF] rounded-xl w-full max-w-xl my-8 overflow-hidden shadow-lg">
        <div className="px-6 py-4 border-b border-[#EDF1EE] flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-bold text-[#112119]">{title}</h3>
            {subtitle && <p className="text-xs text-[#5A6E64] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-[#5A6E64] hover:text-[#112119] hover:bg-[#F2F5F3] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 max-h-[78vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

const inputCls =
  'w-full h-10 px-3 text-xs bg-[#F8FAF9] border border-[#D4DDD8] rounded-lg text-[#112119] focus:outline-none focus:border-[#14532D]';
const labelCls = 'block text-xs font-medium text-[#30433A] mb-1.5';

// -----------------------------------------------------------------------------
// 1. Add / Edit Plant Schedule Modal
// -----------------------------------------------------------------------------
export function PlantModal({
  initial,
  members,
  onClose,
  onSave,
}: {
  initial: PlantSchedule | null;
  members: FarmMember[];
  onClose: () => void;
  onSave: (
    data: Omit<
      PlantSchedule,
      'id' | 'farmId' | 'ownerId' | 'createdAt' | 'updatedAt' | 'waterAssigneeUid' | 'mulchAssigneeUid' | 'pruneAssigneeUid'
    > & { id?: string }
  ) => Promise<void>;
}) {
  const defaultAssignee = members[0]?.id || '';
  const [name, setName] = useState(initial?.name || '');
  const [zone, setZone] = useState(initial?.zone || 'North Raised Beds');
  const [category, setCategory] = useState<PlantCategory>(initial?.category || 'vegetable');
  const [receivesFishWater, setReceivesFishWater] = useState(initial?.receivesFishWater ?? true);

  const [waterEnabled, setWaterEnabled] = useState(initial?.waterEnabled ?? true);
  const [waterEveryDays, setWaterEveryDays] = useState(initial?.waterEveryDays ?? 2);
  const [lastWateredDate, setLastWateredDate] = useState(initial?.lastWateredDate || '');
  const [waterAssigneeId, setWaterAssigneeId] = useState(initial?.waterAssigneeId || defaultAssignee);

  const [mulchEnabled, setMulchEnabled] = useState(initial?.mulchEnabled ?? true);
  const [mulchEveryDays, setMulchEveryDays] = useState(initial?.mulchEveryDays ?? 21);
  const [lastMulchedDate, setLastMulchedDate] = useState(initial?.lastMulchedDate || '');
  const [mulchAssigneeId, setMulchAssigneeId] = useState(initial?.mulchAssigneeId || defaultAssignee);

  const [pruneEnabled, setPruneEnabled] = useState(initial?.pruneEnabled ?? false);
  const [pruneEveryDays, setPruneEveryDays] = useState(initial?.pruneEveryDays ?? 14);
  const [lastPrunedDate, setLastPrunedDate] = useState(initial?.lastPrunedDate || '');
  const [pruneAssigneeId, setPruneAssigneeId] = useState(initial?.pruneAssigneeId || defaultAssignee);

  const [notes, setNotes] = useState(initial?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        name: name.trim(),
        zone: zone.trim() || 'Main Plot',
        category,
        waterEnabled,
        waterEveryDays: Number(waterEveryDays) || 2,
        lastWateredDate,
        waterAssigneeId,
        mulchEnabled,
        mulchEveryDays: Number(mulchEveryDays) || 21,
        lastMulchedDate,
        mulchAssigneeId,
        pruneEnabled,
        pruneEveryDays: Number(pruneEveryDays) || 14,
        lastPrunedDate,
        pruneAssigneeId,
        receivesFishWater,
        notes,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={initial ? 'Edit Plant / Bed' : 'Add Plant / Bed'}
      subtitle="Set how often to water, add mulch, and prune this plant, and choose who does each job."
      onClose={onClose}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Plant or Bed Name *</label>
            <input
              type="text"
              required
              maxLength={SCHEMA_LIMITS.NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Roma Tomatoes — Bed A1"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Plot / Zone *</label>
            <input
              type="text"
              required
              maxLength={SCHEMA_LIMITS.ZONE_MAX}
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              placeholder="e.g. North Raised Beds"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PlantCategory)}
              className={inputCls}
            >
              <option value="vegetable">Vegetable</option>
              <option value="herb">Herb</option>
              <option value="fruit">Fruit</option>
              <option value="orchard">Orchard</option>
              <option value="nursery">Nursery</option>
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-xs text-[#112119] cursor-pointer">
          <input
            type="checkbox"
            checked={receivesFishWater}
            onChange={(e) => setReceivesFishWater(e.target.checked)}
            className="rounded border-[#94A3B8] text-[#0369A1]"
          />
          <span>Eligible to receive fish tank drawdown effluent for irrigation</span>
        </label>

        {/* Watering Section */}
        <div className="pt-4 border-t border-[#EDF1EE] space-y-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-[#112119] cursor-pointer">
            <input
              type="checkbox"
              checked={waterEnabled}
              onChange={(e) => setWaterEnabled(e.target.checked)}
              className="rounded border-[#94A3B8] text-[#14532D]"
            />
            <span>Watering Schedule</span>
          </label>
          {waterEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Every (days)</label>
                <input
                  type="number"
                  min={SCHEMA_LIMITS.WATER_DAYS_MIN}
                  max={SCHEMA_LIMITS.WATER_DAYS_MAX}
                  value={waterEveryDays}
                  onChange={(e) => setWaterEveryDays(Number(e.target.value))}
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>Last Watered</label>
                <input
                  type="date"
                  value={lastWateredDate}
                  onChange={(e) => setLastWateredDate(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>Assigned To</label>
                <select
                  value={waterAssigneeId}
                  onChange={(e) => setWaterAssigneeId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Mulching Section */}
        <div className="pt-4 border-t border-[#EDF1EE] space-y-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-[#112119] cursor-pointer">
            <input
              type="checkbox"
              checked={mulchEnabled}
              onChange={(e) => setMulchEnabled(e.target.checked)}
              className="rounded border-[#94A3B8] text-[#14532D]"
            />
            <span>Mulching Schedule</span>
          </label>
          {mulchEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Every (days)</label>
                <input
                  type="number"
                  min={SCHEMA_LIMITS.CARE_DAYS_MIN}
                  max={SCHEMA_LIMITS.CARE_DAYS_MAX}
                  value={mulchEveryDays}
                  onChange={(e) => setMulchEveryDays(Number(e.target.value))}
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>Last Mulched</label>
                <input
                  type="date"
                  value={lastMulchedDate}
                  onChange={(e) => setLastMulchedDate(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>Assigned To</label>
                <select
                  value={mulchAssigneeId}
                  onChange={(e) => setMulchAssigneeId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Pruning Section */}
        <div className="pt-4 border-t border-[#EDF1EE] space-y-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-[#112119] cursor-pointer">
            <input
              type="checkbox"
              checked={pruneEnabled}
              onChange={(e) => setPruneEnabled(e.target.checked)}
              className="rounded border-[#94A3B8] text-[#14532D]"
            />
            <span>Pruning Schedule</span>
          </label>
          {pruneEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Every (days)</label>
                <input
                  type="number"
                  min={SCHEMA_LIMITS.CARE_DAYS_MIN}
                  max={SCHEMA_LIMITS.CARE_DAYS_MAX}
                  value={pruneEveryDays}
                  onChange={(e) => setPruneEveryDays(Number(e.target.value))}
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>Last Pruned</label>
                <input
                  type="date"
                  value={lastPrunedDate}
                  onChange={(e) => setLastPrunedDate(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>Assigned To</label>
                <select
                  value={pruneAssigneeId}
                  onChange={(e) => setPruneAssigneeId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-[#EDF1EE]">
          <label className={labelCls}>Care Notes</label>
          <textarea
            rows={2}
            maxLength={SCHEMA_LIMITS.NOTES_MAX}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Mulch depth, pruning tips, watering preference…"
            className="w-full p-3 text-xs bg-[#F8FAF9] border border-[#D4DDD8] rounded-lg text-[#112119] focus:outline-none focus:border-[#14532D]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 text-xs font-medium text-[#4B5E55] hover:bg-[#F2F5F3] rounded-lg cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-10 px-5 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] disabled:opacity-60 rounded-lg cursor-pointer"
          >
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add Plant'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// -----------------------------------------------------------------------------
// 2. Add / Edit Fish Tank Modal
// -----------------------------------------------------------------------------
export function FishTankModal({
  initial,
  plants,
  members,
  onClose,
  onSave,
}: {
  initial: FishTank | null;
  plants: PlantSchedule[];
  members: FarmMember[];
  onClose: () => void;
  onSave: (
    data: Omit<FishTank, 'id' | 'farmId' | 'ownerId' | 'createdAt' | 'updatedAt' | 'assigneeUid'> & {
      id?: string;
    }
  ) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [species, setSpecies] = useState(initial?.species || 'African Catfish');
  const [capacityLiters, setCapacityLiters] = useState(initial?.capacityLiters ?? 2000);
  const [intervalDays, setIntervalDays] = useState(initial?.intervalDays ?? 2);
  const [currentStage, setCurrentStage] = useState<TankStage>(initial?.currentStage ?? 1);
  const [nextDrawdownDate, setNextDrawdownDate] = useState(
    initial?.nextDrawdownDate || getTodayDateKey()
  );
  const [lastDrawdownDate, setLastDrawdownDate] = useState(initial?.lastDrawdownDate || '');
  const [assigneeId, setAssigneeId] = useState(initial?.assigneeId || members[0]?.id || '');
  const [irrigationBedIds, setIrrigationBedIds] = useState<string[]>(
    initial?.irrigationBedIds || []
  );
  const [notes, setNotes] = useState(initial?.notes || '');
  const [saving, setSaving] = useState(false);

  const toggleBed = (plantId: string) => {
    setIrrigationBedIds((prev) => {
      if (prev.includes(plantId)) return prev.filter((id) => id !== plantId);
      if (prev.length >= SCHEMA_LIMITS.MAX_IRRIGATION_BEDS) return prev;
      return [...prev, plantId];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        name: name.trim(),
        species: species.trim() || 'Fish',
        capacityLiters: Number(capacityLiters) || 2000,
        intervalDays: Number(intervalDays) || 2,
        currentStage,
        nextDrawdownDate,
        lastDrawdownDate,
        assigneeId,
        irrigationBedIds,
        notes,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={initial ? 'Edit Fish Tank' : 'Add Fish Tank'}
      subtitle="Tracks 1/4 → 2/4 → 3/4 water changes every few days and routes the removed water to your plants."
      onClose={onClose}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Tank Name *</label>
            <input
              type="text"
              required
              maxLength={SCHEMA_LIMITS.NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Main Catfish Tank 1"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Fish Species *</label>
            <input
              type="text"
              required
              maxLength={SCHEMA_LIMITS.NAME_MAX}
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              placeholder="e.g. African Catfish / Nile Tilapia"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Tank Capacity (Liters)</label>
            <input
              type="number"
              min={SCHEMA_LIMITS.TANK_CAPACITY_MIN}
              max={SCHEMA_LIMITS.TANK_CAPACITY_MAX}
              value={capacityLiters}
              onChange={(e) => setCapacityLiters(Number(e.target.value))}
              className={`${inputCls} font-mono`}
            />
          </div>
          <div>
            <label className={labelCls}>Days Between Drawdowns</label>
            <input
              type="number"
              min={SCHEMA_LIMITS.TANK_INTERVAL_MIN}
              max={SCHEMA_LIMITS.TANK_INTERVAL_MAX}
              value={intervalDays}
              onChange={(e) => setIntervalDays(Number(e.target.value))}
              className={`${inputCls} font-mono`}
            />
          </div>
          <div>
            <label className={labelCls}>Next Drawdown Stage</label>
            <select
              value={currentStage}
              onChange={(e) => setCurrentStage(Number(e.target.value) as TankStage)}
              className={inputCls}
            >
              <option value={1}>Stage 1 — Reduce by 1/4 (25%)</option>
              <option value={2}>Stage 2 — Reduce by 2/4 (50%)</option>
              <option value={3}>Stage 3 — Reduce by 3/4 (75% + Refill)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Next Drawdown Date</label>
            <input
              type="date"
              required
              value={nextDrawdownDate}
              onChange={(e) => setNextDrawdownDate(e.target.value)}
              className={`${inputCls} font-mono`}
            />
          </div>
          <div>
            <label className={labelCls}>Assigned Operator</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className={inputCls}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Last Drawdown Date</label>
            <input
              type="date"
              value={lastDrawdownDate}
              onChange={(e) => setLastDrawdownDate(e.target.value)}
              className={`${inputCls} font-mono`}
            />
          </div>
        </div>

        {/* Linked Crop Beds */}
        <div className="pt-3 border-t border-[#EDF1EE]">
          <label className={labelCls}>
            Crop Beds Irrigated With Discharged Water (up to 10)
          </label>
          {plants.length === 0 ? (
            <p className="text-xs text-[#64786E]">Add plants first to link irrigation beds.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5">
              {plants.map((p) => {
                const checked = irrigationBedIds.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                      checked
                        ? 'bg-[#F0F9FF] border-[#7DD3FC] text-[#0C4A6E] font-medium'
                        : 'bg-[#F8FAF9] border-[#E2E8E5] text-[#30433A]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleBed(p.id)}
                      className="rounded border-[#94A3B8] text-[#0369A1]"
                    />
                    <span className="truncate">{p.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label className={labelCls}>Valve &amp; Irrigation Notes</label>
          <textarea
            rows={2}
            maxLength={SCHEMA_LIMITS.NOTES_MAX}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Manifold valve routing, sediment trap flushing, refill reminders…"
            className="w-full p-3 text-xs bg-[#F8FAF9] border border-[#D4DDD8] rounded-lg text-[#112119] focus:outline-none focus:border-[#14532D]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 text-xs font-medium text-[#4B5E55] hover:bg-[#F2F5F3] rounded-lg cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-10 px-5 text-xs font-semibold text-white bg-[#0369A1] hover:bg-[#075985] disabled:opacity-60 rounded-lg cursor-pointer"
          >
            {saving ? 'Saving…' : initial ? 'Save Tank' : 'Add Tank'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// -----------------------------------------------------------------------------
// 3. Add / Edit Custom Task Modal
// -----------------------------------------------------------------------------
export function CustomTaskModal({
  initial,
  members,
  onClose,
  onSave,
}: {
  initial: CustomTask | null;
  members: FarmMember[];
  onClose: () => void;
  onSave: (
    data: Omit<CustomTask, 'id' | 'farmId' | 'ownerId' | 'createdAt' | 'updatedAt' | 'assigneeUid'> & {
      id?: string;
    }
  ) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title || '');
  const [category, setCategory] = useState<TaskCategory>(initial?.category || 'maintenance');
  const [dueDate, setDueDate] = useState(initial?.dueDate || getTodayDateKey());
  const [recurrenceDays, setRecurrenceDays] = useState(initial?.recurrenceDays ?? 0);
  const [assigneeId, setAssigneeId] = useState(initial?.assigneeId || members[0]?.id || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        title: title.trim(),
        category,
        dueDate,
        recurrenceDays: Number(recurrenceDays) || 0,
        assigneeId,
        status: initial?.status || 'pending',
        completedDate: initial?.completedDate || '',
        notes,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={initial ? 'Edit Farm Task' : 'Schedule Custom Farm Task'}
      subtitle="Create a one-time or recurring duty and assign it to a crew member."
      onClose={onClose}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <label className={labelCls}>Task Title *</label>
          <input
            type="text"
            required
            maxLength={SCHEMA_LIMITS.TITLE_MAX}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Check pond aeration stone & water pH"
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TaskCategory)}
              className={inputCls}
            >
              <option value="water">Watering</option>
              <option value="mulch">Mulching</option>
              <option value="prune">Pruning</option>
              <option value="fish_tank">Fish Tank</option>
              <option value="animal">Animal Farm</option>
              <option value="harvest">Harvest</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Assigned Person</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className={inputCls}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Due Date</label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={`${inputCls} font-mono`}
            />
          </div>
          <div>
            <label className={labelCls}>Repeat Every (days, 0 = one-time)</label>
            <input
              type="number"
              min={0}
              max={SCHEMA_LIMITS.RECURRENCE_MAX}
              value={recurrenceDays}
              onChange={(e) => setRecurrenceDays(Number(e.target.value))}
              className={`${inputCls} font-mono`}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Instructions / Notes</label>
          <textarea
            rows={2}
            maxLength={SCHEMA_LIMITS.NOTES_MAX}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional details for the assigned person…"
            className="w-full p-3 text-xs bg-[#F8FAF9] border border-[#D4DDD8] rounded-lg text-[#112119] focus:outline-none focus:border-[#14532D]"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 text-xs font-medium text-[#4B5E55] hover:bg-[#F2F5F3] rounded-lg cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-10 px-5 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] disabled:opacity-60 rounded-lg cursor-pointer"
          >
            {saving ? 'Saving…' : 'Save Task'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// -----------------------------------------------------------------------------
// 4. Add / Edit Crew Member Modal
// -----------------------------------------------------------------------------
export function MemberModal({
  initial,
  onClose,
  onSave,
}: {
  initial: FarmMember | null;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    name: string;
    role: MemberRole;
    specialty: string;
    linkedUid?: string;
    inviteCode?: string;
    active: boolean;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [role, setRole] = useState<MemberRole>(initial?.role || 'worker');
  const [specialty, setSpecialty] = useState(initial?.specialty || '');
  const [active, setActive] = useState(initial?.active ?? true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        name: name.trim(),
        role,
        specialty: specialty.trim(),
        linkedUid: initial?.linkedUid || '',
        inviteCode: initial?.inviteCode || '',
        active,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={initial ? 'Edit Person' : 'Add a Person'}
      subtitle="Add a real farmhand or helper so you can assign daily tasks to them."
      onClose={onClose}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <label className={labelCls}>Full Name *</label>
          <input
            type="text"
            required
            maxLength={SCHEMA_LIMITS.NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter person's name"
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRole)}
              className={inputCls}
            >
              <option value="worker">Farm Worker</option>
              <option value="manager">Farm Manager</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Main Work (optional)</label>
            <input
              type="text"
              maxLength={SCHEMA_LIMITS.SPECIALTY_MAX}
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="e.g. Watering, Fish Tanks, Pruning"
              className={inputCls}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-[#112119] cursor-pointer">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="rounded border-[#94A3B8] text-[#14532D]"
          />
          <span>Show on daily task list</span>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 text-xs font-medium text-[#4B5E55] hover:bg-[#F2F5F3] rounded-lg cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-10 px-5 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] disabled:opacity-60 rounded-lg cursor-pointer"
          >
            {saving ? 'Saving…' : initial ? 'Save Person' : 'Add Person'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// -----------------------------------------------------------------------------
// 5. Farm Settings Modal
// -----------------------------------------------------------------------------
export function FarmSettingsModal({
  farm,
  onClose,
  onSave,
}: {
  farm: Farm;
  onClose: () => void;
  onSave: (data: { name: string; location: string; volumeUnit: VolumeUnit }) => Promise<void>;
}) {
  const [name, setName] = useState(farm.name);
  const [location, setLocation] = useState(farm.location);
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>(farm.volumeUnit);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), location: location.trim(), volumeUnit });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title="Farm Workspace Settings"
      subtitle="Update your farm name, plot location, and water volume display unit."
      onClose={onClose}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <label className={labelCls}>Farm Name *</label>
          <input
            type="text"
            required
            maxLength={SCHEMA_LIMITS.NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Location / Plot Description</label>
          <input
            type="text"
            maxLength={SCHEMA_LIMITS.LOCATION_MAX}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Water Volume Display Unit</label>
          <select
            value={volumeUnit}
            onChange={(e) => setVolumeUnit(e.target.value as VolumeUnit)}
            className={inputCls}
          >
            <option value="L">Liters (L)</option>
            <option value="gal">US Gallons (gal)</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 text-xs font-medium text-[#4B5E55] hover:bg-[#F2F5F3] rounded-lg cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-10 px-5 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] disabled:opacity-60 rounded-lg cursor-pointer"
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// -----------------------------------------------------------------------------
// 6. Add / Edit Animal Group Modal (with Starter Task Presets)
// -----------------------------------------------------------------------------
export function AnimalGroupModal({
  initial,
  members,
  onClose,
  onSave,
}: {
  initial: AnimalGroup | null;
  members: FarmMember[];
  onClose: () => void;
  onSave: (
    data: Omit<AnimalGroup, 'id' | 'farmId' | 'ownerId' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    },
    starterTasks?: { presets: AnimalTaskPreset[]; assigneeId: string }
  ) => Promise<void>;
}) {
  const [animalType, setAnimalType] = useState<AnimalType>(initial?.animalType || 'chicken');
  const [name, setName] = useState(initial?.name || '');
  const [count, setCount] = useState(initial?.count ?? 20);
  const [housing, setHousing] = useState(initial?.housing || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [defaultAssigneeId, setDefaultAssigneeId] = useState(members[0]?.id || '');
  const [selectedPresetIdx, setSelectedPresetIdx] = useState<number[]>([0, 1]);
  const [saving, setSaving] = useState(false);

  const presets = ANIMAL_TASK_PRESETS[animalType] || [];

  const handleTypeChange = (nextType: AnimalType) => {
    setAnimalType(nextType);
    const nextPresets = ANIMAL_TASK_PRESETS[nextType] || [];
    setSelectedPresetIdx(nextPresets.map((_, idx) => idx));
  };

  const togglePreset = (idx: number) => {
    setSelectedPresetIdx((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const chosenPresets = !initial
        ? presets.filter((_, idx) => selectedPresetIdx.includes(idx))
        : [];
      await onSave(
        {
          id: initial?.id,
          name: name.trim(),
          animalType,
          count: Math.max(0, Number(count) || 0),
          housing: housing.trim(),
          notes,
        },
        !initial && chosenPresets.length > 0
          ? { presets: chosenPresets, assigneeId: defaultAssigneeId }
          : undefined
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={initial ? 'Edit Animal Group' : 'Add Animal Group'}
      subtitle="Choose the animal type to get tailored daily feeding, cleaning, and care tasks."
      onClose={onClose}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Animal Type *</label>
            <select
              value={animalType}
              onChange={(e) => handleTypeChange(e.target.value as AnimalType)}
              className={inputCls}
            >
              {(Object.keys(ANIMAL_TYPE_LABELS) as AnimalType[]).map((t) => (
                <option key={t} value={t}>
                  {ANIMAL_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Group Name *</label>
            <input
              type="text"
              required
              maxLength={SCHEMA_LIMITS.NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                animalType === 'fish'
                  ? 'e.g. Catfish Pond 2'
                  : animalType === 'chicken'
                    ? 'e.g. Chickens — Coop 2'
                    : animalType === 'duck'
                      ? 'e.g. Ducks — Pen B'
                      : 'e.g. Goat Pen 1'
              }
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Approximate Count</label>
            <input
              type="number"
              min={0}
              max={1000000}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className={`${inputCls} font-mono`}
            />
          </div>
          <div>
            <label className={labelCls}>Pen / Coop / Pond Location</label>
            <input
              type="text"
              maxLength={SCHEMA_LIMITS.HOUSING_MAX}
              value={housing}
              onChange={(e) => setHousing(e.target.value)}
              placeholder="e.g. Coop 1, Duck Pen A, Tank 2"
              className={inputCls}
            />
          </div>
        </div>

        {!initial && presets.length > 0 && (
          <div className="pt-3 border-t border-[#EDF1EE] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-[#112119]">
                Auto-add recommended {ANIMAL_TYPE_LABELS[animalType].toLowerCase()} tasks
              </label>
              <select
                value={defaultAssigneeId}
                onChange={(e) => setDefaultAssigneeId(e.target.value)}
                aria-label="Assign starter tasks to"
                className="h-8 px-2.5 text-xs bg-[#F8FAF9] border border-[#D4DDD8] rounded-lg text-[#112119]"
              >
                <option value="">Assign later</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    Assign to {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              {presets.map((preset, idx) => {
                const checked = selectedPresetIdx.includes(idx);
                return (
                  <label
                    key={preset.title}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer ${
                      checked
                        ? 'bg-[#EEF6F0] border-[#B7CEC0] text-[#112119]'
                        : 'bg-[#F8FAF9] border-[#E2E8E5] text-[#5A6E64]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePreset(idx)}
                      className="mt-0.5 rounded border-[#94A3B8] text-[#14532D]"
                    />
                    <span>
                      <strong className="font-semibold">{preset.title}</strong>{' '}
                      <span className="text-[#5A6E64]">
                        ({preset.everyDays === 1 ? 'Daily' : `Every ${preset.everyDays}d`})
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <label className={labelCls}>Notes</label>
          <textarea
            rows={2}
            maxLength={SCHEMA_LIMITS.NOTES_MAX}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Feed brand, bedding type, water details…"
            className="w-full p-3 text-xs bg-[#F8FAF9] border border-[#D4DDD8] rounded-lg text-[#112119] focus:outline-none focus:border-[#14532D]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 text-xs font-medium text-[#4B5E55] hover:bg-[#F2F5F3] rounded-lg cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-10 px-5 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] disabled:opacity-60 rounded-lg cursor-pointer"
          >
            {saving ? 'Saving…' : initial ? 'Save Group' : 'Add Animal Group'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// -----------------------------------------------------------------------------
// 7. Add / Edit Animal Care Task Modal
// -----------------------------------------------------------------------------
export function AnimalTaskModal({
  initial,
  defaultAnimal,
  animals,
  members,
  onClose,
  onSave,
}: {
  initial: AnimalTask | null;
  defaultAnimal?: AnimalGroup | null;
  animals: AnimalGroup[];
  members: FarmMember[];
  onClose: () => void;
  onSave: (
    data: Omit<AnimalTask, 'id' | 'farmId' | 'ownerId' | 'createdAt' | 'updatedAt' | 'assigneeUid'> & {
      id?: string;
    }
  ) => Promise<void>;
}) {
  const firstAnimal = defaultAnimal || animals.find((a) => a.id === initial?.animalId) || animals[0];
  const [animalId, setAnimalId] = useState(initial?.animalId || firstAnimal?.id || '');
  const selectedAnimal = animals.find((a) => a.id === animalId) || firstAnimal;
  const activeAnimalType: AnimalType =
    selectedAnimal?.animalType || initial?.animalType || 'chicken';

  const [title, setTitle] = useState(initial?.title || '');
  const [taskKind, setTaskKind] = useState<AnimalTaskKind>(initial?.taskKind || 'feeding');
  const [everyDays, setEveryDays] = useState(initial?.everyDays ?? 1);
  const [lastDoneDate, setLastDoneDate] = useState(initial?.lastDoneDate || '');
  const [assigneeId, setAssigneeId] = useState(initial?.assigneeId || members[0]?.id || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [saving, setSaving] = useState(false);

  const presets = ANIMAL_TASK_PRESETS[activeAnimalType] || [];

  const applyPreset = (preset: AnimalTaskPreset) => {
    setTitle(preset.title);
    setTaskKind(preset.taskKind);
    setEveryDays(preset.everyDays);
    setNotes(preset.notes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        animalId: selectedAnimal?.id || animalId || 'general',
        animalName: selectedAnimal?.name || initial?.animalName || ANIMAL_TYPE_LABELS[activeAnimalType],
        animalType: activeAnimalType,
        taskKind,
        title: title.trim(),
        everyDays: Number(everyDays) || 1,
        lastDoneDate,
        assigneeId,
        notes,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={initial ? 'Edit Animal Task' : 'Add Animal Care Task'}
      subtitle="Schedule recurring feeding, cleaning, egg collection, or water checks and assign a worker."
      onClose={onClose}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {animals.length > 0 && (
          <div>
            <label className={labelCls}>Animal Group *</label>
            <select
              value={animalId}
              onChange={(e) => setAnimalId(e.target.value)}
              className={inputCls}
            >
              {animals.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({ANIMAL_TYPE_LABELS[a.animalType]})
                </option>
              ))}
            </select>
          </div>
        )}

        {!initial && presets.length > 0 && (
          <div>
            <div className="text-xs font-medium text-[#5A6E64] mb-1.5">
              Quick templates for {ANIMAL_TYPE_LABELS[activeAnimalType]}:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.title}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="px-2.5 py-1.5 text-xs font-medium text-[#14532D] bg-[#EEF6F0] hover:bg-[#DCFCE7] rounded-lg transition-colors cursor-pointer"
                >
                  + {p.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className={labelCls}>Task Name *</label>
          <input
            type="text"
            required
            maxLength={SCHEMA_LIMITS.TITLE_MAX}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Feed catfish pellets, Clean duck pen, Collect eggs"
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Task Type</label>
            <select
              value={taskKind}
              onChange={(e) => setTaskKind(e.target.value as AnimalTaskKind)}
              className={inputCls}
            >
              {(Object.keys(ANIMAL_TASK_KIND_LABELS) as AnimalTaskKind[]).map((k) => (
                <option key={k} value={k}>
                  {ANIMAL_TASK_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Assigned Person</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className={inputCls}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Repeat Every (days)</label>
            <input
              type="number"
              min={SCHEMA_LIMITS.CARE_DAYS_MIN}
              max={SCHEMA_LIMITS.CARE_DAYS_MAX}
              value={everyDays}
              onChange={(e) => setEveryDays(Number(e.target.value))}
              className={`${inputCls} font-mono`}
            />
          </div>

          <div>
            <label className={labelCls}>Last Done Date</label>
            <input
              type="date"
              value={lastDoneDate}
              onChange={(e) => setLastDoneDate(e.target.value)}
              className={`${inputCls} font-mono`}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Instructions / Notes</label>
          <textarea
            rows={2}
            maxLength={SCHEMA_LIMITS.NOTES_MAX}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional instructions for the assigned worker…"
            className="w-full p-3 text-xs bg-[#F8FAF9] border border-[#D4DDD8] rounded-lg text-[#112119] focus:outline-none focus:border-[#14532D]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 text-xs font-medium text-[#4B5E55] hover:bg-[#F2F5F3] rounded-lg cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-10 px-5 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] disabled:opacity-60 rounded-lg cursor-pointer"
          >
            {saving ? 'Saving…' : initial ? 'Save Task' : 'Add Task'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// -----------------------------------------------------------------------------
// 8. Worker Join Farm Code Modal
// -----------------------------------------------------------------------------
export function JoinFarmModal({
  onClose,
  onJoin,
}: {
  onClose: () => void;
  onJoin: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sanitizeInviteCode(code);
    if (cleaned.length < 6) {
      setError('Enter the 6-character Join Code given by your farm manager.');
      return;
    }
    setError(null);
    setJoining(true);
    try {
      await onJoin(cleaned);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join farm with that code.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <ModalShell
      title="Join a Manager's Farm"
      subtitle="Enter the 6-character code from your farm manager to view your assigned jobs."
      onClose={onClose}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <label className={labelCls}>6-Character Join Code *</label>
          <input
            type="text"
            required
            maxLength={12}
            value={code}
            onChange={(e) => setCode(sanitizeInviteCode(e.target.value))}
            placeholder="e.g. K7M9P2"
            className="w-full h-12 px-4 text-center font-mono text-lg font-bold tracking-[0.25em] uppercase bg-[#F8FAF9] border border-[#D4DDD8] rounded-lg text-[#112119] focus:outline-none focus:border-[#14532D]"
          />
          <p className="text-[11px] text-[#64786E] mt-1.5">
            Ask your manager to open People &amp; Access and tap Create Join Code next to your name.
          </p>
        </div>

        {error && (
          <div className="p-3 text-xs font-medium text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 text-xs font-medium text-[#4B5E55] hover:bg-[#F2F5F3] rounded-lg cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={joining}
            className="h-10 px-5 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] disabled:opacity-60 rounded-lg cursor-pointer"
          >
            {joining ? 'Joining…' : 'Join Farm'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
