import { useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  Download,
  Edit3,
  KeyRound,
  Plus,
  RotateCcw,
  Trash2,
  Users,
} from 'lucide-react';
import type {
  AnimalTask,
  CompletionLog,
  CustomTask,
  Farm,
  FarmMember,
  FishTank,
  PlantSchedule,
} from '../types';
import {
  formatReadableDate,
  formatVolume,
  isCompletionConfirmed,
  isCompletionPending,
} from '../utils/schedule';

interface TeamLedgerViewProps {
  farm: Farm;
  todayDate: string;
  members: FarmMember[];
  plants: PlantSchedule[];
  fishTanks: FishTank[];
  animalTasks: AnimalTask[];
  tasks: CustomTask[];
  completions: CompletionLog[];
  onAddMember: () => void;
  onEditMember: (member: FarmMember) => void;
  onDeleteMember: (memberId: string) => Promise<void>;
  onGenerateInviteCode: (member: FarmMember) => Promise<string>;
  onOpenJoinFarm: () => void;
  onConfirmCompletion: (log: CompletionLog, alsoWaterLinkedBeds: boolean) => Promise<void>;
  onUndoCompletion: (log: CompletionLog) => Promise<void>;
  onFilterScheduleByMember: (memberId: string) => void;
}

export function TeamLedgerView({
  farm,
  todayDate,
  members,
  plants,
  fishTanks,
  animalTasks,
  tasks,
  completions,
  onAddMember,
  onEditMember,
  onDeleteMember,
  onGenerateInviteCode,
  onOpenJoinFarm,
  onConfirmCompletion,
  onUndoCompletion,
  onFilterScheduleByMember,
}: TeamLedgerViewProps) {
  const [ledgerMemberFilter, setLedgerMemberFilter] = useState('all');
  const [ledgerDateFilter, setLedgerDateFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const memberStats = useMemo(() => {
    return members.map((m) => {
      let recurringDuties = 0;
      for (const p of plants) {
        if (p.waterEnabled && p.waterAssigneeId === m.id) recurringDuties += 1;
        if (p.mulchEnabled && p.mulchAssigneeId === m.id) recurringDuties += 1;
        if (p.pruneEnabled && p.pruneAssigneeId === m.id) recurringDuties += 1;
      }
      for (const t of fishTanks) {
        if (t.assigneeId === m.id) recurringDuties += 1;
      }
      for (const at of animalTasks) {
        if (at.assigneeId === m.id) recurringDuties += 1;
      }
      for (const task of tasks) {
        if (task.assigneeId === m.id && task.status === 'pending') recurringDuties += 1;
      }
      const doneToday = completions.filter(
        (c) =>
          c.dateKey === todayDate && c.assignedMemberId === m.id && isCompletionConfirmed(c)
      ).length;
      const doneTotal = completions.filter(
        (c) => c.assignedMemberId === m.id && isCompletionConfirmed(c)
      ).length;
      return { member: m, recurringDuties, doneToday, doneTotal };
    });
  }, [members, plants, fishTanks, animalTasks, tasks, completions, todayDate]);

  const filteredCompletions = useMemo(() => {
    return completions.filter((c) => {
      if (ledgerMemberFilter !== 'all' && c.assignedMemberId !== ledgerMemberFilter) {
        return false;
      }
      if (ledgerDateFilter && c.dateKey !== ledgerDateFilter) {
        return false;
      }
      return true;
    });
  }, [completions, ledgerMemberFilter, ledgerDateFilter]);

  const handleGenerateCode = async (member: FarmMember) => {
    setBusyId(`code:${member.id}`);
    try {
      await onGenerateInviteCode(member);
    } finally {
      setBusyId(null);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => {
        setCopiedCode((prev) => (prev === code ? null : prev));
      }, 2200);
    } catch {
      // Clipboard blocked in iframe; user can still read and share the bold 6-char code
    }
  };

  const handleExportCsv = () => {
    const header = [
      'Date',
      'Task Type',
      'Activity',
      'Assigned Person',
      'Submitted By',
      'Status',
      'Confirmed By',
      'Tank Stage',
      `Fish Water (${farm.volumeUnit})`,
      'Notes',
    ];
    const rows = filteredCompletions.map((c) => [
      c.dateKey,
      c.taskType,
      `"${c.sourceTitle.replace(/"/g, '""')}"`,
      `"${c.assignedMemberName.replace(/"/g, '""')}"`,
      `"${c.completedByName.replace(/"/g, '""')}"`,
      isCompletionPending(c) ? 'Waiting Confirmation' : 'Confirmed',
      `"${(c.confirmedByName || '').replace(/"/g, '""')}"`,
      c.tankStage || '',
      c.waterVolumeLiters > 0 ? formatVolume(c.waterVolumeLiters, farm.volumeUnit) : '0',
      `"${(c.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `farmsync-work-log-${todayDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleConfirm = async (log: CompletionLog) => {
    setBusyId(log.id);
    try {
      await onConfirmCompletion(log, true);
    } finally {
      setBusyId(null);
    }
  };

  const handleUndo = async (log: CompletionLog) => {
    setBusyId(log.id);
    try {
      await onUndoCompletion(log);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Crew Roster & Worker Access Codes */}
      <div className="bg-white border border-[#E2E8E5] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#EDF1EE] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[#112119] tracking-tight">
              People &amp; Worker Access ({members.length})
            </h2>
            <p className="text-xs text-[#5A6E64] mt-0.5">
              Give each worker a 6-character Join Code so they sign in with their own Google account — never share your manager password.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenJoinFarm}
              className="h-10 px-3.5 text-xs font-medium text-[#30433A] border border-[#DCE4DF] hover:bg-[#F3F6F4] rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Join Another Farm
            </button>
            <button
              type="button"
              onClick={onAddMember}
              className="h-10 px-4 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Person
            </button>
          </div>
        </div>

        <div className="px-6 py-3 bg-[#FAFDFB] border-b border-[#EDF1EE] text-xs text-[#4B5E55]">
          How worker login works: Add a person → click <strong className="text-[#112119]">Create Join Code</strong> → send them the 6-character code. They sign in with their own Google account, enter the code, see only their assigned tasks, and anything they mark done waits for your confirmation.
        </div>

        {members.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="w-8 h-8 text-[#15803D] mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#112119]">No people added yet</p>
            <p className="text-xs text-[#64786E] mt-1 mb-4">
              Add farm workers so every plant and animal job has a clear owner.
            </p>
            <button
              type="button"
              onClick={onAddMember}
              className="h-10 px-4 text-xs font-semibold text-white bg-[#14532D] rounded-lg cursor-pointer"
            >
              Add First Person
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[820px]">
              <thead>
                <tr className="border-b border-[#E6ECE9] bg-[#FAFDFB] text-[11px] font-semibold text-[#5A6E64]">
                  <th className="py-3 px-6">Person</th>
                  <th className="py-3 px-4">Role &amp; Focus</th>
                  <th className="py-3 px-4">Worker Login Access</th>
                  <th className="py-3 px-4 text-right">Assigned Jobs</th>
                  <th className="py-3 px-4 text-right">Done Today</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF1EE] text-xs">
                {memberStats.map(({ member, recurringDuties, doneToday }) => {
                  const isOwner = member.linkedUid === farm.ownerId;
                  const isGenerating = busyId === `code:${member.id}`;

                  return (
                    <tr key={member.id} className="hover:bg-[#FAFDFB] transition-colors">
                      <td className="py-3.5 px-6">
                        <div className="font-semibold text-sm text-[#112119]">{member.name}</div>
                        <div className="text-[11px] text-[#64786E] mt-0.5">
                          {member.active ? 'Active' : 'Inactive'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="capitalize font-medium text-[#30433A]">{member.role}</div>
                        <div className="text-[11px] text-[#64786E] mt-0.5">
                          {member.specialty || 'General farm work'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {isOwner ? (
                          <span className="text-xs font-medium text-[#15803D]">
                            Farm Manager (your login)
                          </span>
                        ) : member.linkedUid ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#15803D]">
                              Connected on own phone
                            </span>
                            <button
                              type="button"
                              disabled={isGenerating}
                              onClick={() => void handleGenerateCode(member)}
                              className="text-[11px] font-medium text-[#5A6E64] hover:text-[#112119] underline cursor-pointer"
                            >
                              {isGenerating ? 'Creating…' : 'New code'}
                            </button>
                          </div>
                        ) : member.inviteCode ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-bold tracking-wider text-[#112119]">
                              {member.inviteCode}
                            </span>
                            <button
                              type="button"
                              onClick={() => void handleCopyCode(member.inviteCode!)}
                              className="h-7 px-2 text-[11px] font-medium text-[#14532D] border border-[#C7DBD0] hover:bg-[#EEF6F0] rounded inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedCode === member.inviteCode ? 'Copied' : 'Copy'}
                            </button>
                            <button
                              type="button"
                              disabled={isGenerating}
                              onClick={() => void handleGenerateCode(member)}
                              className="text-[11px] text-[#64786E] hover:text-[#112119] underline cursor-pointer"
                            >
                              Refresh
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isGenerating}
                            onClick={() => void handleGenerateCode(member)}
                            className="h-8 px-3 text-xs font-semibold text-[#14532D] border border-[#C7DBD0] hover:bg-[#EEF6F0] rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            {isGenerating ? 'Creating…' : 'Create Join Code'}
                          </button>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#112119]">
                        {recurringDuties}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-[#15803D]">
                        {doneToday}
                      </td>
                      <td className="py-3.5 px-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onFilterScheduleByMember(member.id)}
                            className="h-8 px-2.5 text-xs font-medium text-[#14532D] hover:bg-[#EEF6F0] rounded-lg transition-colors cursor-pointer"
                          >
                            Tasks
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditMember(member)}
                            className="h-8 px-2.5 text-xs font-medium text-[#30433A] border border-[#DCE4DF] hover:bg-[#F3F6F4] rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            Edit
                          </button>
                          {!isOwner && (
                            <button
                              type="button"
                              onClick={() => void onDeleteMember(member.id)}
                              aria-label={`Delete ${member.name}`}
                              className="h-8 w-8 inline-flex items-center justify-center text-[#64786E] hover:text-[#B91C1C] hover:bg-[#FEF2F2] rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Completed Work Log */}
      <div className="bg-white border border-[#E2E8E5] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#EDF1EE] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-bold text-[#112119]">
              Work Log &amp; Confirmations ({filteredCompletions.length})
            </h3>
            <p className="text-xs text-[#5A6E64] mt-0.5">
              Every completed plant, fish tank, and animal farm job with manager confirmation status.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={ledgerMemberFilter}
              onChange={(e) => setLedgerMemberFilter(e.target.value)}
              aria-label="Filter log by person"
              className="h-9 px-3 text-xs bg-[#F8FAF9] border border-[#DCE4DF] rounded-lg text-[#112119] focus:outline-none focus:border-[#14532D]"
            >
              <option value="all">Everyone</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={ledgerDateFilter}
              onChange={(e) => setLedgerDateFilter(e.target.value)}
              aria-label="Filter log by date"
              className="h-9 px-3 text-xs bg-[#F8FAF9] border border-[#DCE4DF] rounded-lg text-[#112119] font-mono focus:outline-none focus:border-[#14532D]"
            />

            {ledgerDateFilter && (
              <button
                type="button"
                onClick={() => setLedgerDateFilter('')}
                className="h-9 px-2.5 text-xs text-[#5A6E64] hover:text-[#112119] cursor-pointer"
              >
                Clear
              </button>
            )}

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredCompletions.length === 0}
              className="h-9 px-3.5 text-xs font-medium text-[#30433A] border border-[#DCE4DF] hover:bg-[#F3F6F4] disabled:opacity-50 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {filteredCompletions.length === 0 ? (
          <div className="p-10 text-center text-xs text-[#64786E]">
            No completed tasks logged yet for this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[820px]">
              <thead>
                <tr className="border-b border-[#E6ECE9] bg-[#FAFDFB] text-[11px] font-semibold text-[#5A6E64]">
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-4">Task</th>
                  <th className="py-3 px-4">Submitted By</th>
                  <th className="py-3 px-4">Confirmation</th>
                  <th className="py-3 px-4 text-right">Fish Water</th>
                  <th className="py-3 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF1EE] text-xs">
                {filteredCompletions.map((log) => {
                  const isPending = isCompletionPending(log);
                  const isBusy = busyId === log.id;
                  return (
                    <tr key={log.id} className="hover:bg-[#FAFDFB] transition-colors">
                      <td className="py-3 px-6 font-mono tabular-nums text-[#112119] whitespace-nowrap">
                        {formatReadableDate(log.dateKey)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#112119]">{log.sourceTitle}</div>
                        <div className="text-[11px] text-[#64786E] capitalize">
                          {log.taskType.replace('_', ' ')}
                          {log.tankStage ? ` · ${log.tankStage} drain` : ''}
                          {log.notes ? ` · ${log.notes}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#30433A]">{log.completedByName}</td>
                      <td className="py-3 px-4">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#B45309]">
                            <Clock className="w-3.5 h-3.5" />
                            Waiting confirmation
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-medium text-[#15803D]">
                            <Check className="w-3.5 h-3.5" />
                            Confirmed{log.confirmedByName ? ` (${log.confirmedByName})` : ''}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[#0369A1] whitespace-nowrap">
                        {log.waterVolumeLiters > 0
                          ? formatVolume(log.waterVolumeLiters, farm.volumeUnit)
                          : '—'}
                      </td>
                      <td className="py-3 px-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {isPending && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleConfirm(log)}
                              className="h-8 px-2.5 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] rounded-lg inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                              Confirm
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleUndo(log)}
                            className="h-8 px-2.5 text-xs font-medium text-[#5A6E64] hover:text-[#B91C1C] hover:bg-[#FEF2F2] rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            {isPending ? 'Send Back' : 'Undo'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
