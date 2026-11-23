import type { TankStage, VolumeUnit } from '../types';
import { formatVolume, getStageDischargeLiters, stageToLabel } from '../utils/schedule';

interface TankLevelVisualProps {
  capacityLiters: number;
  currentStage: TankStage;
  volumeUnit: VolumeUnit;
  compact?: boolean;
}

export function TankLevelVisual({
  capacityLiters,
  currentStage,
  volumeUnit,
  compact = false,
}: TankLevelVisualProps) {
  const dischargeLiters = getStageDischargeLiters(capacityLiters, currentStage);
  const remainingQuarters = 4 - currentStage; // 3, 2, or 1
  const remainingPercent = (remainingQuarters / 4) * 100;
  const stageLabel = stageToLabel(currentStage);

  const svgHeight = compact ? 136 : 188;
  const tankTop = 18;
  const tankBottom = svgHeight - 20;
  const tankH = tankBottom - tankTop;
  const tankLeft = 48;
  const tankWidth = compact ? 132 : 168;

  // Water level after this drawdown
  const remainingY = tankTop + (tankH * currentStage) / 4;
  const dischargeHeight = (tankH * currentStage) / 4;
  const remainingHeight = tankH - dischargeHeight;

  const ticks = [
    { label: '4/4', frac: 0 },
    { label: '3/4', frac: 0.25 },
    { label: '2/4', frac: 0.5 },
    { label: '1/4', frac: 0.75 },
    { label: '0', frac: 1 },
  ];

  return (
    <div className="flex flex-col items-start">
      <svg
        viewBox={`0 0 ${tankLeft + tankWidth + 46} ${svgHeight}`}
        className={compact ? 'w-full max-w-[230px]' : 'w-full max-w-[270px]'}
        role="img"
        aria-label={`Fish tank gauge showing ${stageLabel} drawdown (${formatVolume(dischargeLiters, volumeUnit)})`}
      >
        <defs>
          <pattern
            id={`diag-${currentStage}-${compact ? 'c' : 'f'}`}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" stroke="#0369A1" strokeWidth="1.5" strokeOpacity="0.28" />
          </pattern>
        </defs>

        {/* Tank Outer Vessel */}
        <rect
          x={tankLeft}
          y={tankTop}
          width={tankWidth}
          height={tankH}
          rx="6"
          fill="#F8FAFC"
          stroke="#94A3B8"
          strokeWidth="1.5"
        />

        {/* Discharged Irrigation Volume (Top Section Being Removed) */}
        <rect
          x={tankLeft + 1}
          y={tankTop + 1}
          width={tankWidth - 2}
          height={Math.max(0, dischargeHeight - 1)}
          rx="4"
          fill="#E0F2FE"
        />
        <rect
          x={tankLeft + 1}
          y={tankTop + 1}
          width={tankWidth - 2}
          height={Math.max(0, dischargeHeight - 1)}
          rx="4"
          fill={`url(#diag-${currentStage}-${compact ? 'c' : 'f'})`}
        />

        {/* Remaining Fish Tank Water */}
        <rect
          x={tankLeft + 1}
          y={remainingY}
          width={tankWidth - 2}
          height={Math.max(0, remainingHeight - 1)}
          rx="4"
          fill="#0284C7"
          fillOpacity="0.82"
        />

        {/* Waterline Accent */}
        <line
          x1={tankLeft + 1}
          y1={remainingY}
          x2={tankLeft + tankWidth - 1}
          y2={remainingY}
          stroke="#0C4A6E"
          strokeWidth="2"
        />

        {/* Graduated Quarter Markings */}
        {ticks.map((t) => {
          const y = tankTop + tankH * t.frac;
          return (
            <g key={t.label}>
              <line
                x1={tankLeft - 6}
                y1={y}
                x2={tankLeft}
                y2={y}
                stroke="#64748B"
                strokeWidth="1.2"
              />
              {t.frac > 0 && t.frac < 1 && (
                <line
                  x1={tankLeft + 2}
                  y1={y}
                  x2={tankLeft + tankWidth - 2}
                  y2={y}
                  stroke="#0F172A"
                  strokeOpacity="0.14"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
              )}
              <text
                x={tankLeft - 10}
                y={y + 3.5}
                textAnchor="end"
                fontSize="10"
                fontFamily="IBM Plex Mono, monospace"
                fill="#475569"
              >
                {t.label}
              </text>
            </g>
          );
        })}

        {/* Discharge Label inside Removed Band */}
        <text
          x={tankLeft + tankWidth / 2}
          y={tankTop + dischargeHeight / 2 + 4}
          textAnchor="middle"
          fontSize={compact ? '10.5' : '11.5'}
          fontWeight="600"
          fontFamily="IBM Plex Mono, monospace"
          fill="#0369A1"
        >
          −{stageLabel} ({formatVolume(dischargeLiters, volumeUnit)})
        </text>

        {/* Remaining Level Label */}
        {remainingHeight > 26 && (
          <text
            x={tankLeft + tankWidth / 2}
            y={remainingY + remainingHeight / 2 + 4}
            textAnchor="middle"
            fontSize={compact ? '10' : '11'}
            fontWeight="500"
            fontFamily="IBM Plex Mono, monospace"
            fill="#FFFFFF"
          >
            {remainingQuarters}/4 stays ({remainingPercent}%)
          </text>
        )}

        {/* Irrigation Outflow Pipe Graphic */}
        <path
          d={`M ${tankLeft + tankWidth} ${remainingY} L ${tankLeft + tankWidth + 24} ${remainingY} L ${tankLeft + tankWidth + 24} ${tankBottom - 8}`}
          fill="none"
          stroke="#0369A1"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polygon
          points={`${tankLeft + tankWidth + 19},${tankBottom - 9} ${tankLeft + tankWidth + 29},${tankBottom - 9} ${tankLeft + tankWidth + 24},${tankBottom - 1}`}
          fill="#0369A1"
        />
      </svg>
    </div>
  );
}
