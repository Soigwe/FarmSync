import {
  ArrowRight,
  Check,
  ClipboardList,
  Fish,
  KeyRound,
  PawPrint,
  ShieldCheck,
  Sprout,
  Users,
} from 'lucide-react';
import type { ActiveTab, MemberRole } from '../types';

interface HowToUseViewProps {
  userRole: MemberRole;
  memberCount: number;
  plantCount: number;
  animalCount: number;
  tankCount: number;
  completionCount: number;
  onNavigate: (tab: ActiveTab) => void;
  onAddPerson: () => void;
  onAddPlant: () => void;
  onAddAnimal: () => void;
}

export function HowToUseView({
  userRole,
  memberCount,
  plantCount,
  animalCount,
  tankCount,
  completionCount,
  onNavigate,
  onAddPerson,
  onAddPlant,
  onAddAnimal,
}: HowToUseViewProps) {
  if (userRole === 'worker') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-[#E2E8E5] rounded-xl p-6 sm:p-8">
          <h2 className="font-display text-2xl font-bold text-[#112119] tracking-tight">
            How to Use FarmSync (Worker Guide)
          </h2>
          <p className="text-sm text-[#4B5E55] mt-2 max-w-2xl leading-relaxed">
            You are signed in with your own Google account and see only the farm jobs assigned to
            you.
          </p>
        </div>

        <div className="bg-white border border-[#E2E8E5] rounded-xl divide-y divide-[#EDF1EE]">
          <div className="p-6 flex items-start gap-4">
            <span className="w-8 h-8 rounded-lg bg-[#EEF6F0] text-[#14532D] font-mono text-xs font-bold inline-flex items-center justify-center shrink-0">
              01
            </span>
            <div>
              <h3 className="font-display text-sm font-bold text-[#112119]">
                Check My Tasks each morning
              </h3>
              <p className="text-sm text-[#4B5E55] mt-1 leading-relaxed">
                Open <strong className="text-[#112119]">My Tasks</strong> to see your plant jobs
                (watering, mulching, pruning) and animal farm jobs (fish tank water changes,
                feeding catfish, feeding or cleaning chickens and ducks).
              </p>
            </div>
          </div>

          <div className="p-6 flex items-start gap-4">
            <span className="w-8 h-8 rounded-lg bg-[#EEF6F0] text-[#14532D] font-mono text-xs font-bold inline-flex items-center justify-center shrink-0">
              02
            </span>
            <div>
              <h3 className="font-display text-sm font-bold text-[#112119]">
                Tap Mark Done when you finish
              </h3>
              <p className="text-sm text-[#4B5E55] mt-1 leading-relaxed">
                Press <strong className="text-[#112119]">Mark Done</strong> on each finished job. It
                immediately sends to your farm manager and shows as{' '}
                <strong className="text-[#B45309]">Waiting for Manager Confirmation</strong>.
              </p>
            </div>
          </div>

          <div className="p-6 flex items-start gap-4">
            <span className="w-8 h-8 rounded-lg bg-[#EEF6F0] text-[#14532D] font-mono text-xs font-bold inline-flex items-center justify-center shrink-0">
              03
            </span>
            <div>
              <h3 className="font-display text-sm font-bold text-[#112119]">
                Manager confirms your work
              </h3>
              <p className="text-sm text-[#4B5E55] mt-1 leading-relaxed">
                Once your manager checks and confirms the job, it turns green under Confirmed Done
                and schedules the next due date automatically.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const steps = [
    {
      num: '01',
      title: 'Add your workers & give each one a Join Code',
      description:
        'Go to People & Access, add your farmhands, and tap Create Join Code. Workers sign in on their own phones with their own Google account and enter the 6-character code — never share your manager password.',
      done: memberCount > 1,
      statusText:
        memberCount > 1
          ? `${memberCount} people on your farm`
          : 'Only you so far — add your workers when ready',
      actionLabel: 'Add a Person',
      onAction: onAddPerson,
    },
    {
      num: '02',
      title: 'Set up your Plants (watering, mulching, pruning)',
      description:
        'In Plants, list each crop bed, how often it needs watering, mulching, or pruning, and choose who handles each job.',
      done: plantCount > 0,
      statusText: plantCount > 0 ? `${plantCount} plant beds active` : 'No plants added yet',
      actionLabel: 'Add a Plant',
      onAction: onAddPlant,
    },
    {
      num: '03',
      title: 'Set up your Animal Farm (Fish, Chickens, Ducks & more)',
      description:
        'In Animal Farm, manage your fish tank 1/4 → 2/4 → 3/4 water changes plus tailored daily tasks for fish feeding, chickens (feeding, eggs, cleaning coop), ducks (feeding, fresh water, pen cleaning), and other livestock.',
      done: animalCount > 0 || tankCount > 0,
      statusText: `${tankCount} fish tank${tankCount === 1 ? '' : 's'} · ${animalCount} animal group${animalCount === 1 ? '' : 's'}`,
      actionLabel: 'Add Animal Group',
      onAction: onAddAnimal,
    },
    {
      num: '04',
      title: 'Confirm completed tasks from Today’s Tasks',
      description:
        'When a worker marks a task done on their phone, it appears at the top of Today’s Tasks under Waiting for Manager Confirmation. Tap Confirm Done to approve it and advance the schedule, or Send Back if it needs attention.',
      done: completionCount > 0,
      statusText:
        completionCount > 0
          ? `${completionCount} completed job${completionCount === 1 ? '' : 's'} logged`
          : 'Ready for your first daily sign-off',
      actionLabel: "Open Today's Tasks",
      onAction: () => onNavigate('today'),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E2E8E5] rounded-xl p-6 sm:p-8">
        <h2
          className="font-display text-2xl font-bold text-[#112119] tracking-tight"
          style={{ textWrap: 'balance' }}
        >
          How to Use FarmSync on Your Farm
        </h2>
        <p className="text-sm text-[#4B5E55] mt-2 max-w-2xl leading-relaxed">
          Everything is organized into two main farm areas — <strong className="text-[#112119]">Plants</strong> and{' '}
          <strong className="text-[#112119]">Animal Farm</strong> — plus worker phone access with
          manager confirmation.
        </p>
      </div>

      {/* 4-Step Setup Checklist */}
      <div className="bg-white border border-[#E2E8E5] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#EDF1EE]">
          <h3 className="font-display text-base font-bold text-[#112119]">
            Getting Started in 4 Simple Steps
          </h3>
        </div>

        <div className="divide-y divide-[#EDF1EE]">
          {steps.map((step) => (
            <div
              key={step.num}
              className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4 max-w-2xl">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center font-mono text-xs font-semibold shrink-0 ${
                    step.done
                      ? 'bg-[#DCFCE7] text-[#15803D]'
                      : 'bg-[#F2F5F3] text-[#30433A]'
                  }`}
                >
                  {step.done ? <Check className="w-4 h-4" /> : step.num}
                </div>
                <div>
                  <h4 className="font-display text-sm font-bold text-[#112119]">{step.title}</h4>
                  <p className="text-sm text-[#4B5E55] mt-1 leading-relaxed">{step.description}</p>
                  <p className="text-xs text-[#64786E] mt-2 font-medium">{step.statusText}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={step.onAction}
                className="h-10 px-4 text-xs font-semibold text-[#14532D] border border-[#DCE4DF] hover:bg-[#EEF6F0] rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-center"
              >
                {step.actionLabel}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Fish Tank 1/4 -> 2/4 -> 3/4 Cycle Explainer */}
      <div className="bg-white border border-[#E2E8E5] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#EDF1EE] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Fish className="w-5 h-5 text-[#0369A1] shrink-0" />
            <div>
              <h3 className="font-display text-base font-bold text-[#112119]">
                Fish Tank 1/4 → 2/4 → 3/4 Watering Cycle
              </h3>
              <p className="text-xs text-[#5A6E64] mt-0.5">
                Found inside Animal Farm. Removed fish water irrigates your linked plant beds.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('animals')}
            className="text-xs font-semibold text-[#0369A1] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            Open Animal Farm →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#EDF1EE]">
          <div className="p-6 space-y-1.5">
            <div className="font-mono text-base font-bold text-[#0369A1] tabular-nums">
              Day 2 · Drain 1/4
            </div>
            <p className="text-sm text-[#30433A] leading-relaxed">
              Drain one quarter (25%) of the tank water onto linked crop beds.
            </p>
          </div>
          <div className="p-6 space-y-1.5">
            <div className="font-mono text-base font-bold text-[#0369A1] tabular-nums">
              Day 4 · Drain 2/4
            </div>
            <p className="text-sm text-[#30433A] leading-relaxed">
              Two days later, drain half (50%) of the tank water for irrigation.
            </p>
          </div>
          <div className="p-6 space-y-1.5">
            <div className="font-mono text-base font-bold text-[#0369A1] tabular-nums">
              Day 6 · Drain 3/4 + Refill
            </div>
            <p className="text-sm text-[#30433A] leading-relaxed">
              Drain three quarters (75%) for heavy watering, refill fresh water, and restart at 1/4.
            </p>
          </div>
        </div>
      </div>

      {/* Menu Quick Reference */}
      <div className="bg-white border border-[#E2E8E5] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#EDF1EE]">
          <h3 className="font-display text-base font-bold text-[#112119]">
            Quick Guide to Every Section
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 divide-[#EDF1EE]">
          <div className="p-6 border-b border-[#EDF1EE] md:border-r space-y-1.5">
            <div className="flex items-center gap-2 font-display text-sm font-bold text-[#112119]">
              <ClipboardList className="w-4 h-4 text-[#14532D]" />
              <span>Today&apos;s Tasks</span>
            </div>
            <p className="text-sm text-[#4B5E55] leading-relaxed">
              Filter by <strong className="text-[#112119]">Plants</strong> or{' '}
              <strong className="text-[#112119]">Animal Farm</strong>, confirm worker submissions,
              mark jobs done, or tap the trash icon to remove any task.
            </p>
          </div>

          <div className="p-6 border-b border-[#EDF1EE] space-y-1.5">
            <div className="flex items-center gap-2 font-display text-sm font-bold text-[#112119]">
              <Sprout className="w-4 h-4 text-[#14532D]" />
              <span>Plants</span>
            </div>
            <p className="text-sm text-[#4B5E55] leading-relaxed">
              Assign who waters, mulches, and prunes each crop bed, and mark which beds receive fish
              tank water.
            </p>
          </div>

          <div className="p-6 border-b md:border-b-0 md:border-r border-[#EDF1EE] space-y-1.5">
            <div className="flex items-center gap-2 font-display text-sm font-bold text-[#112119]">
              <PawPrint className="w-4 h-4 text-[#14532D]" />
              <span>Animal Farm</span>
            </div>
            <p className="text-sm text-[#4B5E55] leading-relaxed">
              Manage fish tank water changes alongside feeding, cleaning, egg collection, and health
              tasks for fish, chickens, ducks, goats, and other animals.
            </p>
          </div>

          <div className="p-6 space-y-1.5">
            <div className="flex items-center gap-2 font-display text-sm font-bold text-[#112119]">
              <Users className="w-4 h-4 text-[#14532D]" />
              <span>People &amp; Access</span>
            </div>
            <p className="text-sm text-[#4B5E55] leading-relaxed">
              <span className="inline-flex items-center gap-1 font-medium text-[#112119]">
                <KeyRound className="w-3.5 h-3.5 text-[#14532D]" /> Create Join Codes
              </span>{' '}
              for workers and review all{' '}
              <span className="inline-flex items-center gap-1 font-medium text-[#112119]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#14532D]" /> Manager Confirmations
              </span>{' '}
              in the work log.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
