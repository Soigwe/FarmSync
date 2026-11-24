import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  KeyRound,
  LogOut,
  Menu,
  PawPrint,
  Plus,
  Settings,
  Sprout,
  Users,
  X,
} from 'lucide-react';
import { AnimalFarmView } from './components/AnimalFarmView';
import { AuthGate } from './components/AuthGate';
import { CalendarAlertsView } from './components/CalendarAlertsView';
import { HowToUseView } from './components/HowToUseView';
import {
  AnimalGroupModal,
  AnimalTaskModal,
  CustomTaskModal,
  FarmSettingsModal,
  FishTankModal,
  JoinFarmModal,
  MemberModal,
  PlantModal,
} from './components/Modals';
import { PlantsCareView } from './components/PlantsCareView';
import { TeamLedgerView } from './components/TeamLedgerView';
import { TodayScheduleView } from './components/TodayScheduleView';
import { useFarmData } from './hooks/useFarmData';
import {
  completeScheduledActivity,
  confirmWorkerCompletion,
  deleteAnimalGroup,
  deleteAnimalTask,
  deleteCustomTask,
  deleteFarmMember,
  deleteFishTank,
  deletePlantSchedule,
  disablePlantCareSchedule,
  generateMemberInviteCode,
  saveAnimalGroup,
  saveAnimalTask,
  saveCustomTask,
  saveFarmMember,
  saveFishTank,
  savePlantSchedule,
  undoCompletionLog,
  updateFarmSettings,
} from './services/farmService';
import type {
  ActiveTab,
  AnimalGroup,
  AnimalTask,
  CompletionLog,
  CustomTask,
  FarmMember,
  FishTank,
  PlantSchedule,
  ScheduledActivity,
} from './types';
import { buildDailySchedule, getTodayDateKey, isCompletionPending } from './utils/schedule';

export default function App() {
  const {
    user,
    authLoading,
    dataLoading,
    authError,
    userRole,
    activeMemberId,
    farm,
    members,
    plants,
    fishTanks,
    animals,
    animalTasks,
    tasks,
    completions,
    signInWithGoogle,
    signOutUser,
    joinFarmByCode,
    switchToOwnFarm,
  } = useFarmData();

  const isManager = userRole === 'manager';
  const todayDate = useMemo(() => getTodayDateKey(), []);
  const [activeTab, setActiveTab] = useState<ActiveTab>('today');
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Modal states
  const [plantModalState, setPlantModalState] = useState<{ open: boolean; item: PlantSchedule | null }>({
    open: false,
    item: null,
  });
  const [tankModalState, setTankModalState] = useState<{ open: boolean; item: FishTank | null }>({
    open: false,
    item: null,
  });
  const [animalModalState, setAnimalModalState] = useState<{ open: boolean; item: AnimalGroup | null }>({
    open: false,
    item: null,
  });
  const [animalTaskModalState, setAnimalTaskModalState] = useState<{
    open: boolean;
    item: AnimalTask | null;
    defaultAnimal?: AnimalGroup | null;
  }>({
    open: false,
    item: null,
    defaultAnimal: null,
  });
  const [taskModalState, setTaskModalState] = useState<{ open: boolean; item: CustomTask | null }>({
    open: false,
    item: null,
  });
  const [memberModalState, setMemberModalState] = useState<{ open: boolean; item: FarmMember | null }>({
    open: false,
    item: null,
  });
  const [joinFarmOpen, setJoinFarmOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3600);
  };

  // Compute live today's schedule & alerts
  const todaySchedule = useMemo(() => {
    if (!farm) return [];
    return buildDailySchedule({
      selectedDate: todayDate,
      todayDate,
      plants,
      fishTanks,
      animalTasks,
      tasks,
      members,
      completions,
      volumeUnit: farm.volumeUnit,
    });
  }, [farm, todayDate, plants, fishTanks, animalTasks, tasks, members, completions]);

  const pendingTodayAlerts = useMemo(
    () => todaySchedule.filter((a) => !a.isDoneForDay && !a.isPendingConfirmation),
    [todaySchedule]
  );

  const pendingConfirmationsCount = useMemo(
    () => completions.filter((c) => isCompletionPending(c)).length,
    [completions]
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F6F8F7] flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="font-display text-lg font-bold text-[#112119]">FarmSync</div>
          <p className="text-xs text-[#5A6E64]">Checking session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate onSignIn={signInWithGoogle} authError={authError} />;
  }

  if (dataLoading || !farm) {
    return (
      <div className="min-h-screen bg-[#F6F8F7] flex">
        <aside className="hidden lg:block w-64 bg-white border-r border-[#E2E8E5] p-6 space-y-4">
          <div className="h-6 w-28 bg-[#E6ECE9] rounded animate-pulse" />
          <div className="space-y-2 pt-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="h-10 bg-[#EFF3F0] rounded-lg animate-pulse" />
            ))}
          </div>
        </aside>
        <main className="flex-1 p-6 lg:p-8 space-y-6">
          <div className="h-24 bg-white border border-[#E2E8E5] rounded-xl animate-pulse" />
          <div className="h-96 bg-white border border-[#E2E8E5] rounded-xl animate-pulse" />
        </main>
      </div>
    );
  }

  const effectiveTab: ActiveTab =
    !isManager && activeTab !== 'today' && activeTab !== 'guide' ? 'today' : activeTab;

  const handleCompleteActivity = async (
    activity: ScheduledActivity,
    options: {
      note: string;
      alsoWaterLinkedBeds: boolean;
      actingMemberName: string;
      submitForConfirmation?: boolean;
    }
  ) => {
    const result = await completeScheduledActivity({
      farm,
      user,
      userRole,
      activeMemberId,
      activity,
      dateKey: selectedDate,
      plants,
      fishTanks,
      animalTasks,
      tasks,
      members,
      signOffNote: options.note,
      alsoWaterLinkedBeds: options.alsoWaterLinkedBeds,
      actingMemberName: options.actingMemberName,
      submitForConfirmation: options.submitForConfirmation,
    });

    if (result === 'pending_confirmation') {
      showToast(`Sent to your manager for confirmation: ${activity.title}`);
    } else if (activity.taskType === 'fish_tank') {
      showToast(
        `${activity.tankStageLabel} water change confirmed — next step set in 2 days${
          options.alsoWaterLinkedBeds && (activity.linkedPlantIds?.length || 0) > 0
            ? ' & linked beds watered'
            : ''
        }.`
      );
    } else {
      showToast(`Confirmed done: ${activity.title}`);
    }
  };

  const handleConfirmCompletion = async (log: CompletionLog, alsoWaterLinkedBeds: boolean) => {
    await confirmWorkerCompletion({
      farm,
      user,
      log,
      plants,
      fishTanks,
      animalTasks,
      tasks,
      members,
      alsoWaterLinkedBeds,
    });
    showToast(`Confirmed: ${log.sourceTitle}`);
  };

  const handleUndoCompletion = async (log: CompletionLog) => {
    await undoCompletionLog({
      farmId: farm.id,
      log,
      fishTanks,
      tasks,
      isManager,
    });
    showToast(
      isCompletionPending(log)
        ? isManager
          ? `Sent back to worker: ${log.sourceTitle}`
          : `Withdrawn: ${log.sourceTitle}`
        : `Reopened: ${log.sourceTitle}`
    );
  };

  const handleDeleteActivity = async (activity: ScheduledActivity) => {
    if (!isManager) return;
    if (activity.taskType === 'custom') {
      await deleteCustomTask(farm.id, activity.sourceId);
      showToast(`Deleted task: ${activity.title}`);
    } else if (activity.taskType === 'animal') {
      await deleteAnimalTask(farm.id, activity.sourceId);
      showToast(`Deleted animal task: ${activity.title}`);
    } else if (activity.taskType === 'fish_tank') {
      await deleteFishTank(farm.id, activity.sourceId);
      showToast('Fish tank deleted.');
    } else if (
      activity.taskType === 'water' ||
      activity.taskType === 'mulch' ||
      activity.taskType === 'prune'
    ) {
      await disablePlantCareSchedule(farm.id, activity.sourceId, activity.taskType);
      showToast(`Turned off ${activity.taskType} schedule for this plant.`);
    }
  };

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    icon: typeof ClipboardList;
    count?: number;
  }> = isManager
    ? [
        {
          id: 'today',
          label: "Today's Tasks",
          icon: ClipboardList,
          count: pendingTodayAlerts.length + pendingConfirmationsCount,
        },
        {
          id: 'plants',
          label: 'Plants',
          icon: Sprout,
          count: plants.length,
        },
        {
          id: 'animals',
          label: 'Animal Farm',
          icon: PawPrint,
          count: animals.length + fishTanks.length,
        },
        {
          id: 'calendar',
          label: '2-Week Plan',
          icon: CalendarDays,
        },
        {
          id: 'team',
          label: 'People & Access',
          icon: Users,
          count: members.filter((m) => m.active).length,
        },
        {
          id: 'guide',
          label: 'How to Use',
          icon: BookOpen,
        },
      ]
    : [
        {
          id: 'today',
          label: 'My Tasks',
          icon: ClipboardList,
          count: pendingTodayAlerts.length,
        },
        {
          id: 'guide',
          label: 'How to Use',
          icon: BookOpen,
        },
      ];

  const activeNavLabel = navItems.find((n) => n.id === effectiveTab)?.label || "Today's Tasks";

  const primaryAction = (() => {
    if (!isManager) return null;
    if (effectiveTab === 'plants') {
      return {
        label: 'Add Plant',
        onClick: () => setPlantModalState({ open: true, item: null }),
      };
    }
    if (effectiveTab === 'animals') {
      return {
        label: 'Add Animal',
        onClick: () => setAnimalModalState({ open: true, item: null }),
      };
    }
    if (effectiveTab === 'team') {
      return {
        label: 'Add Person',
        onClick: () => setMemberModalState({ open: true, item: null }),
      };
    }
    return {
      label: 'Add Task',
      onClick: () => setTaskModalState({ open: true, item: null }),
    };
  })();

  const totalAlertsBadge = pendingTodayAlerts.length + (isManager ? pendingConfirmationsCount : 0);

  return (
    <div className="min-h-screen bg-[#F6F8F7] flex">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-white border-r border-[#E2E8E5] sticky top-0 h-screen">
        <div className="h-16 px-6 flex items-center justify-between border-b border-[#EDF1EE]">
          <span className="font-display text-lg font-bold tracking-tight text-[#112119] whitespace-nowrap shrink-0">
            FarmSync
          </span>
          {!isManager && (
            <span className="text-[11px] font-semibold text-[#0369A1]">Worker</span>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="Primary navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = effectiveTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full h-11 px-3.5 rounded-lg flex items-center justify-between gap-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#EEF6F0] text-[#14532D] font-semibold'
                    : 'text-[#4B5E55] hover:bg-[#F4F7F5] hover:text-[#112119]'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.count === 'number' && (
                  <span className="font-mono text-xs tabular-nums text-[#5A6E64]">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Workspace & Account Footer */}
        <div className="p-4 border-t border-[#EDF1EE] space-y-2.5">
          <div className="px-2">
            <div className="text-xs font-semibold text-[#112119] truncate">{farm.name}</div>
            <div className="text-[11px] text-[#64786E] truncate mt-0.5">
              {isManager ? `${farm.location || 'My Farm'} · ${farm.volumeUnit}` : 'Worker Access'}
            </div>
          </div>

          {isManager ? (
            <>
              <button
                type="button"
                onClick={() => setJoinFarmOpen(true)}
                className="w-full h-9 px-3 text-xs font-medium text-[#14532D] border border-[#DCE4DF] hover:bg-[#EEF6F0] rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Join a Farm with Code
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="flex-1 h-9 px-3 text-xs font-medium text-[#30433A] bg-[#F4F7F5] hover:bg-[#E7EFEA] rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Settings
                </button>
                <button
                  type="button"
                  onClick={() => void signOutUser()}
                  aria-label="Sign out"
                  className="h-9 px-3 text-xs font-medium text-[#5A6E64] hover:text-[#B91C1C] hover:bg-[#FEF2F2] rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => void switchToOwnFarm()}
                className="w-full h-9 px-3 text-xs font-medium text-[#30433A] bg-[#F4F7F5] hover:bg-[#E7EFEA] rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                Open My Own Farm
              </button>
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="w-full h-9 px-3 text-xs font-medium text-[#B91C1C] bg-[#FEF2F2] hover:bg-[#FEE2E2] rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#0A1811]/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[82vw] bg-white h-full flex flex-col z-10 border-r border-[#E2E8E5]">
            <div className="h-16 px-5 flex items-center justify-between border-b border-[#EDF1EE]">
              <span className="font-display text-lg font-bold text-[#112119]">FarmSync</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-[#4B5E55]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = effectiveTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full h-11 px-3.5 rounded-lg flex items-center justify-between text-sm font-medium ${
                      active
                        ? 'bg-[#EEF6F0] text-[#14532D] font-semibold'
                        : 'text-[#4B5E55] hover:bg-[#F4F7F5]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </span>
                    {typeof item.count === 'number' && (
                      <span className="font-mono text-xs tabular-nums">{item.count}</span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-[#EDF1EE] space-y-2">
              {isManager ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setJoinFarmOpen(true);
                    }}
                    className="w-full h-10 text-xs font-medium text-[#14532D] border border-[#DCE4DF] rounded-lg"
                  >
                    Join a Farm with Code
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setSettingsOpen(true);
                      }}
                      className="flex-1 h-10 text-xs font-medium text-[#30433A] bg-[#F4F7F5] rounded-lg"
                    >
                      Farm Settings
                    </button>
                    <button
                      type="button"
                      onClick={() => void signOutUser()}
                      className="h-10 px-3 text-xs font-medium text-[#B91C1C] bg-[#FEF2F2] rounded-lg"
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      void switchToOwnFarm();
                    }}
                    className="w-full h-10 text-xs font-medium text-[#30433A] bg-[#F4F7F5] rounded-lg"
                  >
                    Open My Own Farm
                  </button>
                  <button
                    type="button"
                    onClick={() => void signOutUser()}
                    className="w-full h-10 text-xs font-medium text-[#B91C1C] bg-[#FEF2F2] rounded-lg"
                  >
                    Sign Out
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top SaaS Bar */}
        <header className="h-16 bg-white border-b border-[#E2E8E5] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden h-10 w-10 inline-flex items-center justify-center rounded-lg text-[#30433A] hover:bg-[#F3F6F4]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0 truncate">
              <span className="text-[#64786E] truncate hidden sm:inline">{farm.name}</span>
              <span className="text-[#CBD5CE] hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-display font-semibold text-[#112119] truncate">
                {activeNavLabel}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 relative">
            {/* Live Due & Confirmation Alerts Popover */}
            <button
              type="button"
              onClick={() => setAlertsOpen((o) => !o)}
              aria-label="View due farm alerts"
              className="h-10 px-3 text-xs font-medium text-[#30433A] border border-[#DCE4DF] hover:bg-[#F3F6F4] rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Bell className="w-4 h-4 text-[#14532D]" />
              <span className="hidden sm:inline">Alerts</span>
              <span
                className={`font-mono tabular-nums font-semibold ${
                  totalAlertsBadge > 0 ? 'text-[#B45309]' : 'text-[#15803D]'
                }`}
              >
                {totalAlertsBadge}
              </span>
            </button>

            {alertsOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setAlertsOpen(false)}
                />
                <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 bg-white border border-[#DCE4DF] rounded-xl shadow-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#EDF1EE] flex items-center justify-between">
                    <span className="font-display text-xs font-bold text-[#112119]">
                      Farm Alerts ({totalAlertsBadge})
                    </span>
                    {isManager && (
                      <button
                        type="button"
                        onClick={() => {
                          setAlertsOpen(false);
                          setActiveTab('calendar');
                        }}
                        className="text-xs font-medium text-[#14532D] hover:underline cursor-pointer"
                      >
                        2-Week Plan
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-[#F0F4F1]">
                    {isManager && pendingConfirmationsCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDate(todayDate);
                          setActiveTab('today');
                          setAlertsOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 bg-[#FFFBEB] hover:bg-[#FEF3C7] transition-colors cursor-pointer"
                      >
                        <div className="text-xs font-bold text-[#92400E]">
                          {pendingConfirmationsCount} worker task
                          {pendingConfirmationsCount === 1 ? '' : 's'} waiting for your confirmation
                        </div>
                        <div className="text-[11px] text-[#92400E]/80 mt-0.5">
                          Tap to review and confirm in Today&apos;s Tasks
                        </div>
                      </button>
                    )}

                    {pendingTodayAlerts.length === 0 && pendingConfirmationsCount === 0 ? (
                      <div className="p-5 text-xs text-[#64786E] text-center">
                        All scheduled farm tasks for today are done.
                      </div>
                    ) : (
                      pendingTodayAlerts.slice(0, 8).map((a) => (
                        <button
                          key={a.key}
                          type="button"
                          onClick={() => {
                            setSelectedDate(todayDate);
                            setSelectedMemberFilter('all');
                            setActiveTab('today');
                            setAlertsOpen(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-[#FAFDFB] transition-colors cursor-pointer"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs font-semibold text-[#112119] truncate">
                              {a.title}
                            </span>
                            <span
                              className={`text-[11px] font-medium shrink-0 ${
                                a.urgency === 'overdue' ? 'text-[#B91C1C]' : 'text-[#B45309]'
                              }`}
                            >
                              {a.urgency === 'overdue' ? `Late ${a.daysOverdue}d` : 'Today'}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#64786E] mt-0.5">
                            {a.assigneeName} · {a.zoneOrDetail}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

            {primaryAction && (
              <button
                type="button"
                onClick={primaryAction.onClick}
                className="h-10 px-4 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {primaryAction.label}
              </button>
            )}
          </div>
        </header>

        {/* Active View Canvas */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1280px] w-full mx-auto">
          {effectiveTab === 'today' && (
            <TodayScheduleView
              farm={farm}
              userRole={userRole}
              todayDate={todayDate}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              plants={plants}
              fishTanks={fishTanks}
              animalTasks={animalTasks}
              tasks={tasks}
              members={members}
              completions={completions}
              selectedMemberFilter={selectedMemberFilter}
              onSelectMemberFilter={setSelectedMemberFilter}
              onCompleteActivity={handleCompleteActivity}
              onConfirmCompletion={handleConfirmCompletion}
              onUndoCompletion={handleUndoCompletion}
              onDeleteActivity={handleDeleteActivity}
              onOpenNewTask={() => setTaskModalState({ open: true, item: null })}
              onOpenAddPerson={() => setMemberModalState({ open: true, item: null })}
              onJumpToAnimalFarm={() => setActiveTab('animals')}
            />
          )}

          {effectiveTab === 'plants' && isManager && (
            <PlantsCareView
              farm={farm}
              todayDate={todayDate}
              plants={plants}
              members={members}
              onAddPlant={() => setPlantModalState({ open: true, item: null })}
              onEditPlant={(plant) => setPlantModalState({ open: true, item: plant })}
              onDeletePlant={async (plantId) => {
                await deletePlantSchedule(farm.id, plantId);
                showToast('Plant removed.');
              }}
              onQuickLogPlantCare={handleCompleteActivity}
            />
          )}

          {effectiveTab === 'animals' && isManager && (
            <AnimalFarmView
              farm={farm}
              todayDate={todayDate}
              fishTanks={fishTanks}
              animals={animals}
              animalTasks={animalTasks}
              plants={plants}
              members={members}
              onAddTank={() => setTankModalState({ open: true, item: null })}
              onEditTank={(tank) => setTankModalState({ open: true, item: tank })}
              onDeleteTank={async (tankId) => {
                await deleteFishTank(farm.id, tankId);
                showToast('Fish tank removed.');
              }}
              onAddAnimal={() => setAnimalModalState({ open: true, item: null })}
              onEditAnimal={(animal) => setAnimalModalState({ open: true, item: animal })}
              onDeleteAnimal={async (animal) => {
                await deleteAnimalGroup(farm.id, animal.id, animalTasks);
                showToast(`Removed ${animal.name} and its tasks.`);
              }}
              onAddAnimalTask={(defaultAnimal) =>
                setAnimalTaskModalState({ open: true, item: null, defaultAnimal })
              }
              onEditAnimalTask={(task) =>
                setAnimalTaskModalState({ open: true, item: task, defaultAnimal: null })
              }
              onDeleteAnimalTask={async (taskId) => {
                await deleteAnimalTask(farm.id, taskId);
                showToast('Animal task removed.');
              }}
              onCompleteActivity={handleCompleteActivity}
            />
          )}

          {effectiveTab === 'calendar' && isManager && (
            <CalendarAlertsView
              farm={farm}
              todayDate={todayDate}
              plants={plants}
              fishTanks={fishTanks}
              animalTasks={animalTasks}
              tasks={tasks}
              members={members}
              completions={completions}
              onJumpToDate={(dateKey) => {
                setSelectedDate(dateKey);
                setActiveTab('today');
              }}
            />
          )}

          {effectiveTab === 'team' && isManager && (
            <TeamLedgerView
              farm={farm}
              todayDate={todayDate}
              members={members}
              plants={plants}
              fishTanks={fishTanks}
              animalTasks={animalTasks}
              tasks={tasks}
              completions={completions}
              onAddMember={() => setMemberModalState({ open: true, item: null })}
              onEditMember={(member) => setMemberModalState({ open: true, item: member })}
              onDeleteMember={async (memberId) => {
                await deleteFarmMember(farm.id, memberId);
                showToast('Person removed.');
              }}
              onGenerateInviteCode={async (member) => {
                const code = await generateMemberInviteCode({
                  farm,
                  member,
                  plants,
                  fishTanks,
                  animalTasks,
                  tasks,
                });
                showToast(`Join code created for ${member.name}: ${code}`);
                return code;
              }}
              onOpenJoinFarm={() => setJoinFarmOpen(true)}
              onConfirmCompletion={handleConfirmCompletion}
              onUndoCompletion={handleUndoCompletion}
              onFilterScheduleByMember={(memberId) => {
                setSelectedMemberFilter(memberId);
                setSelectedDate(todayDate);
                setActiveTab('today');
              }}
            />
          )}

          {effectiveTab === 'guide' && (
            <HowToUseView
              userRole={userRole}
              memberCount={members.filter((m) => m.active).length}
              plantCount={plants.length}
              animalCount={animals.length}
              tankCount={fishTanks.length}
              completionCount={completions.length}
              onNavigate={setActiveTab}
              onAddPerson={() => setMemberModalState({ open: true, item: null })}
              onAddPlant={() => setPlantModalState({ open: true, item: null })}
              onAddAnimal={() => setAnimalModalState({ open: true, item: null })}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {plantModalState.open && (
        <PlantModal
          initial={plantModalState.item}
          members={members}
          onClose={() => setPlantModalState({ open: false, item: null })}
          onSave={async (data) => {
            await savePlantSchedule(farm, members, data);
            showToast(data.id ? 'Plant updated.' : 'Plant added.');
          }}
        />
      )}

      {tankModalState.open && (
        <FishTankModal
          initial={tankModalState.item}
          plants={plants}
          members={members}
          onClose={() => setTankModalState({ open: false, item: null })}
          onSave={async (data) => {
            await saveFishTank(farm, members, data);
            showToast(data.id ? 'Fish tank updated.' : 'Fish tank added.');
          }}
        />
      )}

      {animalModalState.open && (
        <AnimalGroupModal
          initial={animalModalState.item}
          members={members}
          onClose={() => setAnimalModalState({ open: false, item: null })}
          onSave={async (data, starterTasks) => {
            const animalId = await saveAnimalGroup(farm, data);
            if (starterTasks && starterTasks.presets.length > 0) {
              for (const preset of starterTasks.presets) {
                await saveAnimalTask(farm, members, {
                  animalId,
                  animalName: data.name,
                  animalType: data.animalType,
                  taskKind: preset.taskKind,
                  title: preset.title,
                  everyDays: preset.everyDays,
                  lastDoneDate: '',
                  assigneeId: starterTasks.assigneeId,
                  notes: preset.notes,
                });
              }
            }
            showToast(data.id ? 'Animal group updated.' : 'Animal group added.');
          }}
        />
      )}

      {animalTaskModalState.open && (
        <AnimalTaskModal
          initial={animalTaskModalState.item}
          defaultAnimal={animalTaskModalState.defaultAnimal}
          animals={animals}
          members={members}
          onClose={() =>
            setAnimalTaskModalState({ open: false, item: null, defaultAnimal: null })
          }
          onSave={async (data) => {
            await saveAnimalTask(farm, members, data);
            showToast(data.id ? 'Animal task updated.' : 'Animal task added.');
          }}
        />
      )}

      {taskModalState.open && (
        <CustomTaskModal
          initial={taskModalState.item}
          members={members}
          onClose={() => setTaskModalState({ open: false, item: null })}
          onSave={async (data) => {
            await saveCustomTask(farm, members, data);
            showToast(data.id ? 'Task updated.' : 'Task added.');
          }}
        />
      )}

      {memberModalState.open && (
        <MemberModal
          initial={memberModalState.item}
          onClose={() => setMemberModalState({ open: false, item: null })}
          onSave={async (data) => {
            await saveFarmMember(farm, data);
            showToast(data.id ? 'Person updated.' : 'Person added.');
          }}
        />
      )}

      {joinFarmOpen && (
        <JoinFarmModal
          onClose={() => setJoinFarmOpen(false)}
          onJoin={async (code) => {
            await joinFarmByCode(code);
            setActiveTab('today');
            showToast('Joined farm! Showing your assigned tasks.');
          }}
        />
      )}

      {settingsOpen && (
        <FarmSettingsModal
          farm={farm}
          onClose={() => setSettingsOpen(false)}
          onSave={async (data) => {
            await updateFarmSettings(farm.id, data);
            showToast('Farm settings saved.');
          }}
        />
      )}

      {/* Subtle Action Confirmation Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 bg-[#112119] text-white text-xs font-medium px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 max-w-sm"
        >
          <CheckCircle2 className="w-4 h-4 text-[#86EFAC] shrink-0" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
