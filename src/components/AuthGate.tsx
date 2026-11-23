import { useState } from 'react';
import { CalendarCheck2, Droplets, Fish, Sprout, Users } from 'lucide-react';

interface AuthGateProps {
  onSignIn: () => Promise<void>;
  authError: string | null;
}

const HERO_IMG = '/src/assets/images/hero_farm_aerial_1795425745206.jpg';

export function AuthGate({ onSignIn, authError }: AuthGateProps) {
  const [submitting, setSubmitting] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const handleClick = async () => {
    setSubmitting(true);
    try {
      await onSignIn();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8F7] grid lg:grid-cols-12 items-stretch">
      {/* Left Documentary Visual Panel */}
      <div className="relative lg:col-span-7 min-h-[320px] lg:min-h-screen bg-[#13291E] overflow-hidden flex flex-col justify-between p-8 lg:p-12">
        {!imgFailed ? (
          <img
            src={HERO_IMG}
            alt="Integrated farm beds and circular aquaculture fish tanks piped for irrigation"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#143D28] via-[#102E20] to-[#0D2118]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A1811]/90 via-[#0A1811]/45 to-[#0A1811]/30" />

        <div className="relative z-10 flex items-center justify-between">
          <span className="font-display text-xl font-bold tracking-tight text-white">
            FurrowFlow
          </span>
        </div>

        <div className="relative z-10 max-w-xl mt-16 lg:mt-0">
          <h1
            className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-white leading-[1.12] tracking-tight mb-4"
            style={{ textWrap: 'balance' }}
          >
            Every crop bed, fish tank drawdown, and crew sign-off in one daily schedule.
          </h1>
          <p className="text-sm sm:text-base text-white/85 leading-relaxed max-w-lg mb-8">
            Track per-plant watering, mulching, and pruning cycles alongside your stepped
            1/4, 2/4, and 3/4 fish tank irrigation drawdowns — assigned to each farmhand and
            signed off daily.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-white/20 text-white/90 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-white">
                <Droplets className="w-3.5 h-3.5 text-[#86EFAC]" />
                <span>Crop Care Cadence</span>
              </div>
              <p className="text-white/75 leading-relaxed">
                Watering, mulching &amp; pruning alerts per plant bed.
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-white">
                <Fish className="w-3.5 h-3.5 text-[#7DD3FC]" />
                <span>Stepped Tank Cycles</span>
              </div>
              <p className="text-white/75 leading-relaxed">
                1/4 → 2/4 → 3/4 every 2 days routed to irrigation.
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-white">
                <Users className="w-3.5 h-3.5 text-[#FDE68A]" />
                <span>Crew Daily Sign-Off</span>
              </div>
              <p className="text-white/75 leading-relaxed">
                Assign tasks per person and log daily completion.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sign-In Column */}
      <div className="lg:col-span-5 flex items-center justify-center p-8 lg:p-14 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <p className="text-xs font-medium text-[#15803D] mb-2">
              Farm Operations Workspace
            </p>
            <h2 className="font-display text-2xl font-bold text-[#112119] tracking-tight mb-2">
              Sign in to your farm schedule
            </h2>
            <p className="text-sm text-[#4B5E55] leading-relaxed">
              Your crop care intervals, fish tank drawdown states, crew assignments, and daily
              completion logs sync securely to your cloud farm workspace.
            </p>
          </div>

          <div className="space-y-3 mb-8 py-5 border-y border-[#E6ECE9] text-sm text-[#30433A]">
            <div className="flex items-start gap-3">
              <Sprout className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
              <span>Pre-configured starter farm with beds, crew roster &amp; fish tanks ready to customize</span>
            </div>
            <div className="flex items-start gap-3">
              <CalendarCheck2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
              <span>Automatic overdue alerts &amp; 14-day drawdown irrigation forecast</span>
            </div>
          </div>

          {authError && (
            <div className="mb-5 p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
              {authError}
            </div>
          )}

          <button
            type="button"
            onClick={handleClick}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-3 px-5 py-3 text-sm font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D]"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M21.35 11.1h-9.18v2.98h5.27c-.23 1.46-1.71 4.28-5.27 4.28-3.17 0-5.76-2.63-5.76-5.86s2.59-5.86 5.76-5.86c1.81 0 3.02.77 3.71 1.43l2.53-2.44C16.79 4.1 14.68 3.2 12.17 3.2 7.12 3.2 3.04 7.28 3.04 12.5s4.08 9.3 9.13 9.3c5.27 0 8.76-3.7 8.76-8.92 0-.6-.06-1.18-.18-1.78z"
              />
            </svg>
            {submitting ? 'Connecting to workspace…' : 'Continue with Google'}
          </button>

          <p className="mt-5 text-xs text-[#64786E] leading-relaxed">
            Private to your account. Assign crew members on your farm roster and log daily task
            completions from any desktop or tablet.
          </p>
        </div>
      </div>
    </div>
  );
}
