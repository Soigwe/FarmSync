import { useMemo, useState } from 'react';
import {
  Bell,
  BellOff,
  Check,
  Clock,
  Droplets,
  Fish,
  Layers,
  PawPrint,
  Scissors,
  Wrench,
} from 'lucide-react';
import type {
  AnimalTask,
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
  formatShortDay,
  formatVolume,
} from '../utils/schedule';

interface CalendarAlertsViewProps {
  farm: Farm;
  todayDate: string;
  plants: PlantSchedule[];
  fishTanks: FishTank[];
  animalTasks: AnimalTask[];
  tasks: CustomTask[];
  members: FarmMember[];
  completions: CompletionLog[];
  onJumpToDate: (dateKey: string) => void;
}

export function CalendarAlertsView({
  farm,
  todayDate,
  plants,
  fishTanks,
  animalTasks,
  tasks,
  members,
  completions,
  onJumpToDate,
}: CalendarAlertsViewProps) {
  const [memberFilter, setMemberFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState<'all' | 'plants' | 'animals' | 'general'>('all');
  const [notifStatus, setNotifStatus] = useState<string>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const [testNotice, setTestNotice] = useState<string | null>(null);

  const days14 = useMemo(() => {
    const arr: Array<{ dateKey: string; activities: ScheduledActivity[] }> = [];
    for (let i = 0; i < 14; i++) {
      const dateKey = addDays(todayDate, i);
      const list = buildDailySchedule({
        selectedDate: dateKey,
        todayDate,
        plants,
        fishTanks,
        animalTasks,
        tasks,
        members,
        completions,
        volumeUnit: farm.volumeUnit,
      }).filter((a) => {
        if (memberFilter !== 'all' && a.assigneeId !== memberFilter) return false;
        if (areaFilter !== 'all' && a.farmArea !== areaFilter) return false;
        return true;
      });
      arr.push({ dateKey, activities: list });
    }
    return arr;
  }, [todayDate, plants, fishTanks, animalTasks, tasks, members, completions, farm.volumeUnit, memberFilter, areaFilter]);

  const todayAlerts = useMemo(
    () => days14[0]?.activities.filter((a) => !a.isDoneForDay) || [],
    [days14]
  );

  const handleEnableNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setTestNotice('Browser desktop notifications are not supported in this browser; in-app alerts remain active.');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotifStatus(perm);
      if (perm === 'granted') {
        const count = todayAlerts.length;
        new Notification('FarmSync Farm Alerts Enabled', {
          body:
            count > 0
              ? `You have ${count} farm activities due today on ${farm.name}.`
              : `All scheduled tasks on ${farm.name} are up to date.`,
        });
        setTestNotice('Browser alerts enabled. A confirmation notification was sent.');
      } else {
        setTestNotice('Notification permission was not granted. In-app due alerts remain active.');
      }
    } catch {
      setTestNotice('Unable to trigger browser notifications inside this preview frame; in-app alerts remain active.');
    }
  };

  const handleSendSummaryTest = () => {
    const overdue = todayAlerts.filter((a) => a.urgency === 'overdue').length;
    const tankDue = todayAlerts.filter((a) => a.taskType === 'fish_tank').length;
    const summary = `${todayAlerts.length} activities pending today (${overdue} overdue, ${tankDue} fish tank water change${tankDue === 1 ? '' : 's'}).`;

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`${farm.name} — Daily Plan`, { body: summary });
        setTestNotice(`Notification sent: ${summary}`);
        return;
      } catch {
        // Fallback to in-app confirmation
      }
    }
    setTestNotice(`Daily Reminder Preview: ${summary}`);
  };

  const renderIcon = (taskType: ScheduledActivity['taskType']) => {
    switch (taskType) {
      case 'fish_tank':
        return <Fish className="w-3.5 h-3.5 text-[#0369A1] shrink-0" />;
      case 'animal':
        return <PawPrint className="w-3.5 h-3.5 text-[#B45309] shrink-0" />;
      case 'water':
        return <Droplets className="w-3.5 h-3.5 text-[#0284C7] shrink-0" />;
      case 'mulch':
        return <Layers className="w-3.5 h-3.5 text-[#92400E] shrink-0" />;
      case 'prune':
        return <Scissors className="w-3.5 h-3.5 text-[#15803D] shrink-0" />;
      default:
        return <Wrench className="w-3.5 h-3.5 text-[#475569] shrink-0" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Notification Preferences & Dispatch Header */}
      <div className="bg-white border border-[#E2E8E5] rounded-xl p-6 flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-2xl">
          <h2 className="font-display text-lg font-bold text-[#112119] tracking-tight">
            2-Week Farm Plan &amp; Reminders
          </h2>
          <p className="text-xs text-[#5A6E64] mt-1 leading-relaxed">
            See every watering, mulching, pruning, and fish tank 1/4 → 2/4 → 3/4 water change
            coming up over the next 14 days. Tap any day to open its task list.
          </p>
          {testNotice && (
            <p className="mt-3 text-xs font-medium text-[#14532D] bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg px-3 py-2">
              {testNotice}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {notifStatus === 'granted' ? (
            <button
              type="button"
              onClick={handleSendSummaryTest}
              className="h-10 px-4 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              Send Today&apos;s Alert Digest
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleEnableNotifications()}
              className="h-10 px-4 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {notifStatus === 'denied' ? (
                <BellOff className="w-3.5 h-3.5" />
              ) : (
                <Bell className="w-3.5 h-3.5" />
              )}
              Enable Browser Alerts
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E2E8E5] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMemberFilter('all')}
            className={`h-9 px-3 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              memberFilter === 'all'
                ? 'bg-[#112119] text-white'
                : 'bg-[#F2F5F3] text-[#3D5247] hover:bg-[#E5ECE8]'
            }`}
          >
            Everyone
          </button>
          {members
            .filter((m) => m.active)
            .map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMemberFilter(m.id)}
                className={`h-9 px-3 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  memberFilter === m.id
                    ? 'bg-[#14532D] text-white'
                    : 'bg-[#F2F5F3] text-[#3D5247] hover:bg-[#E5ECE8]'
                }`}
              >
                {m.name}
              </button>
            ))}
        </div>

        <div className="flex items-center gap-1 bg-[#F2F5F3] p-1 rounded-lg overflow-x-auto">
          {(
            [
              { id: 'all', label: 'All Areas' },
              { id: 'plants', label: 'Plants' },
              { id: 'animals', label: 'Animal Farm' },
              { id: 'general', label: 'Other' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setAreaFilter(opt.id)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                areaFilter === opt.id
                  ? 'bg-white text-[#112119] shadow-xs'
                  : 'text-[#52665C] hover:text-[#112119]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 14-Day Rolling Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
        {days14.map(({ dateKey, activities }, idx) => {
          const { weekday, dayNum, month } = formatShortDay(dateKey);
          const isToday = idx === 0;
          const fishLiters = activities
            .filter((a) => a.taskType === 'fish_tank')
            .reduce((sum, a) => sum + (a.waterVolumeLiters || 0), 0);

          return (
            <div
              key={dateKey}
              className={`bg-white border rounded-xl overflow-hidden flex flex-col ${
                isToday ? 'border-[#14532D]' : 'border-[#E2E8E5]'
              }`}
            >
              <div className="px-5 py-3.5 border-b border-[#EDF1EE] flex items-center justify-between gap-3 bg-[#FAFDFB]">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-sm font-bold text-[#112119] tabular-nums">
                    {weekday}, {month} {dayNum}
                  </span>
                  {isToday && (
                    <span className="text-xs font-semibold text-[#15803D]">Today</span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {fishLiters > 0 && (
                    <span className="font-mono text-xs font-medium text-[#0369A1] tabular-nums">
                      {formatVolume(fishLiters, farm.volumeUnit)} fish water
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onJumpToDate(dateKey)}
                    className="text-xs font-medium text-[#14532D] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Open Day →
                  </button>
                </div>
              </div>

              {activities.length === 0 ? (
                <div className="px-5 py-6 text-xs text-[#7A8E84]">
                  No activities scheduled for this filter.
                </div>
              ) : (
                <div className="divide-y divide-[#F0F4F1]">
                  {activities.map((a) => (
                    <div
                      key={a.key}
                      className="px-5 py-3 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="mt-0.5">{renderIcon(a.taskType)}</div>
                        <div className="min-w-0">
                          <div
                            className={`font-medium truncate ${
                              a.isDoneForDay ? 'text-[#64786E] line-through' : 'text-[#112119]'
                            }`}
                          >
                            {a.title}
                          </div>
                          <div className="text-[11px] text-[#64786E] mt-0.5">
                            {a.assigneeName} · {a.cadenceLabel}
                            {a.urgency === 'overdue' && !a.isDoneForDay && (
                              <span className="text-[#B91C1C] font-medium">
                                {' '}
                                · Late {a.daysOverdue}d
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {a.isPendingConfirmation ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#B45309] shrink-0">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      ) : a.isDoneForDay ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#15803D] shrink-0">
                          <Check className="w-3 h-3" />
                          Done
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
